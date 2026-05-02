import type { Sex } from "@/db/db";

export type AnalysisInputs = {
  sex: Sex;
  heightCm?: number;
  weightKg?: number;
  bodyFatPctManual?: number;
  waistCm?: number;
  neckCm?: number;
  hipCm?: number;
};

export type Status = "low" | "normal" | "elevated" | "high" | "unknown";

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

// U.S. Navy body fat %
export function navyBodyFat(i: AnalysisInputs): number | null {
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
