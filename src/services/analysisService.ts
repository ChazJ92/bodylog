import type { Sex } from "@/db/db";

export type AnalysisInputs = {
  sex: Sex;
  heightCm?: number;
  weightKg?: number;
  bodyFatPctManual?: number;
  birthYear?: number;
  waistCm?: number;
  neckCm?: number;
  hipCm?: number;
};

export type Status = "low" | "normal" | "elevated" | "high" | "unknown";

/** Collapse whitespace; trim; lowercase — for matching measurement type display names. */
export function normalizeMeasurementTypeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Resolve waist / neck / hip circumferences for analysis from check-in measurements.
 *
 * - Prefers built-in canonical type ids (`hips` before legacy `hip`; `waist` before `waists`).
 * - Falls back to matching the type's display name (case-insensitive) to waist/waists, neck, hip/hips
 *   so legacy or custom types still feed formulas without rewriting stored rows.
 */
export function resolveAnalysisCircumferences(
  measurements: readonly { measurementTypeId: string; valueCm: number }[],
  typesById: ReadonlyMap<string, { name: string }>,
): Pick<AnalysisInputs, "waistCm" | "neckCm" | "hipCm"> {
  const byType = new Map<string, number>();
  for (const m of measurements) {
    if (typeof m.valueCm !== "number" || !Number.isFinite(m.valueCm) || m.valueCm <= 0) continue;
    byType.set(m.measurementTypeId, m.valueCm);
  }

  const firstPositiveByIds = (orderedIds: readonly string[]): number | undefined => {
    for (const id of orderedIds) {
      const v = byType.get(id);
      if (v != null && v > 0) return v;
    }
    return undefined;
  };

  let waistCm = firstPositiveByIds(["waist", "waists"]);
  let neckCm = firstPositiveByIds(["neck"]);
  let hipCm = firstPositiveByIds(["hips", "hip"]);

  for (const m of measurements) {
    if (typeof m.valueCm !== "number" || !Number.isFinite(m.valueCm) || m.valueCm <= 0) continue;
    const t = typesById.get(m.measurementTypeId);
    if (!t) continue;
    const key = normalizeMeasurementTypeName(t.name);
    if (waistCm == null && (key === "waist" || key === "waists")) waistCm = m.valueCm;
    if (neckCm == null && key === "neck") neckCm = m.valueCm;
    if (hipCm == null && (key === "hip" || key === "hips")) hipCm = m.valueCm;
  }

  const out: Pick<AnalysisInputs, "waistCm" | "neckCm" | "hipCm"> = {};
  if (waistCm != null) out.waistCm = waistCm;
  if (neckCm != null) out.neckCm = neckCm;
  if (hipCm != null) out.hipCm = hipCm;
  return out;
}

export function bmi(weightKg?: number, heightCm?: number): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  if (m <= 0) return null;
  return weightKg / (m * m);
}

export function bmiCategory(b: number | null): Status {
  if (b == null) return "unknown";
  if (b < 18.5) return "low";
  if (b < 25) return "normal";
  if (b < 30) return "elevated";
  return "high";
}

/**
 * U.S. Navy body fat % — raw formula output (can be negative or nonsensical if
 * measurements are inconsistent). Prefer `navyBodyFat` for display and downstream use.
 */
export function navyBodyFatRaw(i: AnalysisInputs): number | null {
  const { sex, heightCm, waistCm, neckCm, hipCm } = i;
  if (!heightCm || !waistCm || !neckCm) return null;
  if (sex === "male") {
    const denom = waistCm - neckCm;
    if (denom <= 0) return null;
    const v = 495 / (1.0324 - 0.19077 * Math.log10(denom) + 0.15456 * Math.log10(heightCm)) - 450;
    return Number.isFinite(v) ? v : null;
  }
  if (sex === "female") {
    if (!hipCm) return null;
    const denom = waistCm + hipCm - neckCm;
    if (denom <= 0) return null;
    const v = 495 / (1.29579 - 0.35004 * Math.log10(denom) + 0.22100 * Math.log10(heightCm)) - 450;
    return Number.isFinite(v) ? v : null;
  }
  return null; // requires sex=male/female
}

/** Navy body fat % for UI and derived mass — same range as other estimates (2–80%). */
export function navyBodyFat(i: AnalysisInputs): number | null {
  const v = navyBodyFatRaw(i);
  if (v == null || !Number.isFinite(v)) return null;
  if (v < 2 || v > 80) return null;
  return v;
}

/**
 * Deurenberg et al. — BMI-based body fat estimate (%).
 *
 * Uses the common linear form: BF% = 1.20×BMI + 0.23×age − 10.8×sex − 5.4,
 * where sex is 1 for male and 0 for female. **Age is required**; this app
 * derives age from `birthYear` and `refYear` (calendar year), which is an
 * approximation when day-of-birth is unknown.
 *
 * Returns null when sex is not male/female, BMI cannot be computed, or birth year is missing.
 */
export function deurenbergBodyFat(
  i: AnalysisInputs,
  refYear: number = new Date().getFullYear(),
): number | null {
  if (i.sex !== "male" && i.sex !== "female") return null;
  const age = ageFromBirthYear(i.birthYear, refYear);
  if (age == null) return null;
  const b = bmi(i.weightKg, i.heightCm);
  if (b == null) return null;
  const sexTerm = i.sex === "male" ? 1 : 0;
  const v = 1.2 * b + 0.23 * age - 10.8 * sexTerm - 5.4;
  if (!Number.isFinite(v)) return null;
  if (v < 2 || v > 80) return null;
  return v;
}

/**
 * Relative Fat Mass (RFM) — height and waist in the same unit (cm); result is body fat %.
 * Woolcott & Bergman-style formulation: men 64 − 20×(height/waist), women 76 − 20×(height/waist).
 */
export function rfmBodyFat(i: AnalysisInputs): number | null {
  const { sex, heightCm, waistCm } = i;
  if (sex !== "male" && sex !== "female") return null;
  if (!heightCm || !waistCm) return null;
  if (waistCm <= 0) return null;
  const ratio = heightCm / waistCm;
  const v = sex === "male" ? 64 - 20 * ratio : 76 - 20 * ratio;
  if (!Number.isFinite(v)) return null;
  if (v < 2 || v > 80) return null;
  return v;
}

export function ageFromBirthYear(birthYear: number | undefined, refYear: number): number | null {
  if (birthYear == null || !Number.isFinite(birthYear)) return null;
  const y = Math.trunc(birthYear);
  if (y < 1900 || y > refYear) return null;
  const age = refYear - y;
  if (age < 10 || age > 120) return null;
  return age;
}

export function bodyFatStatus(pct: number | null, sex: Sex): Status {
  if (pct == null) return "unknown";
  if (sex === "male") {
    if (pct < 6) return "low";
    if (pct < 18) return "normal";
    if (pct < 25) return "elevated";
    return "high";
  }
  if (sex === "female") {
    if (pct < 14) return "low";
    if (pct < 25) return "normal";
    if (pct < 32) return "elevated";
    return "high";
  }
  return "unknown";
}

export function waistToHip(waistCm?: number, hipCm?: number): number | null {
  if (!waistCm || !hipCm) return null;
  return waistCm / hipCm;
}

export function whrStatus(r: number | null, sex: Sex): Status {
  if (r == null) return "unknown";
  if (sex === "male") {
    if (r < 0.9) return "normal";
    if (r < 1.0) return "elevated";
    return "high";
  }
  if (sex === "female") {
    if (r < 0.8) return "normal";
    if (r < 0.85) return "elevated";
    return "high";
  }
  return "unknown";
}

export function waistToHeight(waistCm?: number, heightCm?: number): number | null {
  if (!waistCm || !heightCm) return null;
  return waistCm / heightCm;
}

export function whtrStatus(r: number | null): Status {
  if (r == null) return "unknown";
  if (r < 0.4) return "low";
  if (r < 0.5) return "normal";
  if (r < 0.6) return "elevated";
  return "high";
}

export function leanMassKg(weightKg?: number, bfPct?: number | null): number | null {
  if (!weightKg || bfPct == null) return null;
  return weightKg * (1 - bfPct / 100);
}
export function fatMassKg(weightKg?: number, bfPct?: number | null): number | null {
  if (!weightKg || bfPct == null) return null;
  return weightKg * (bfPct / 100);
}

// --- Explicit unavailable reasons (metric-specific; avoid vague copy) ---

export function reasonBmiUnavailable(i: AnalysisInputs): string | null {
  if (!i.weightKg) return "Weight not recorded on the latest check-in.";
  if (!i.heightCm) return "Height not set in Settings.";
  return null;
}

export function reasonNavyBodyFatUnavailable(i: AnalysisInputs): string | null {
  if (i.sex !== "male" && i.sex !== "female") {
    return "Sex must be male or female for this formula.";
  }
  if (!i.heightCm) return "Height not set in Settings.";
  if (!i.waistCm) return "Waist measurement not available.";
  if (!i.neckCm) return "Neck measurement missing.";
  if (i.sex === "female" && !i.hipCm) return "Hip measurement not available.";
  if (i.sex === "male" && i.waistCm <= i.neckCm) {
    return "Waist must be greater than neck for the Navy formula.";
  }
  if (
    i.sex === "female" &&
    i.hipCm != null &&
    i.waistCm + i.hipCm <= i.neckCm
  ) {
    return "Waist plus hip must be greater than neck for the Navy formula.";
  }
  const raw = navyBodyFatRaw(i);
  if (raw != null && (raw < 2 || raw > 80)) {
    return "Navy formula produced an implausible body fat percentage (outside 2–80%). Check waist, neck, and hip measurements for consistency.";
  }
  return null;
}

/** Call when navyBodyFat(i) is null — covers edge cases not caught above. */
export function reasonNavyBodyFatUnavailableOrGeneric(i: AnalysisInputs): string {
  return reasonNavyBodyFatUnavailable(i) ?? "Navy body fat could not be calculated from these measurements.";
}

export function reasonWaistToHipUnavailable(i: AnalysisInputs): string | null {
  if (!i.waistCm) return "Waist measurement not available.";
  if (!i.hipCm) return "Hip measurement not available.";
  return null;
}

export function reasonWaistToHeightUnavailable(i: AnalysisInputs): string | null {
  if (!i.waistCm) return "Waist measurement not available.";
  if (!i.heightCm) return "Height not set in Settings.";
  return null;
}

export function reasonDeurenbergUnavailable(i: AnalysisInputs, refYear?: number): string | null {
  if (i.sex !== "male" && i.sex !== "female") {
    return "Sex must be male or female for this formula.";
  }
  if (i.birthYear == null) {
    return "Birth year missing, so Deurenberg estimate cannot be calculated.";
  }
  const y = refYear ?? new Date().getFullYear();
  if (ageFromBirthYear(i.birthYear, y) == null) {
    return "Birth year is invalid or out of range for age estimation.";
  }
  if (!i.weightKg) return "Weight not recorded on the latest check-in.";
  if (!i.heightCm) return "Height not set in Settings.";
  return null;
}

export function reasonDeurenbergUnavailableOrGeneric(
  i: AnalysisInputs,
  refYear?: number,
): string {
  return (
    reasonDeurenbergUnavailable(i, refYear) ??
    "Deurenberg estimate could not be calculated (check BMI inputs and age)."
  );
}

export function reasonRfmUnavailable(i: AnalysisInputs): string | null {
  if (i.sex !== "male" && i.sex !== "female") {
    return "Sex must be male or female for this formula.";
  }
  if (!i.heightCm) return "Height not set in Settings.";
  if (!i.waistCm) return "Waist measurement not available.";
  return null;
}

export function reasonRfmUnavailableOrGeneric(i: AnalysisInputs): string {
  return reasonRfmUnavailable(i) ?? "RFM could not be calculated from these inputs.";
}

export function reasonLeanFatMassUnavailable(
  i: AnalysisInputs,
  navyBf: number | null,
  manualBf: number | null,
): string | null {
  if (!i.weightKg) return "Weight not recorded on the latest check-in.";
  if (navyBf == null && manualBf == null) {
    return "No body fat estimate available — add Navy inputs or self-reported body fat on check-in.";
  }
  return null;
}

export function reasonManualBodyFatUnavailable(i: AnalysisInputs): string | null {
  if (i.bodyFatPctManual == null) return "Self-reported body fat not entered on the latest check-in.";
  return null;
}
