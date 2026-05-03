import type { LengthUnit, WeightUnit } from "@/db/db";

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const inToCm = (i: number) => i * CM_PER_IN;

export function fromDisplayWeight(value: number, unit: WeightUnit): number {
  return unit === "kg" ? value : lbToKg(value);
}
export function toDisplayWeight(kg: number, unit: WeightUnit): number {
  return unit === "kg" ? kg : kgToLb(kg);
}
export function fromDisplayLength(value: number, unit: LengthUnit): number {
  return unit === "cm" ? value : inToCm(value);
}
export function toDisplayLength(cm: number, unit: LengthUnit): number {
  return unit === "cm" ? cm : cmToIn(cm);
}

export const weightSuffix = (u: WeightUnit) => (u === "kg" ? "kg" : "lb");
export const lengthSuffix = (u: LengthUnit) => (u === "cm" ? "cm" : "in");

/**
 * Render a canonical-cm range as a `min–max unit` string in the active
 * display unit. Used to keep validation messages aligned with the unit the
 * user is actually typing in. cm is shown as integers; inches with one
 * decimal place because the converted bounds rarely land on a whole inch.
 */
export function displayLengthRange(
  minCm: number,
  maxCm: number,
  unit: LengthUnit,
): string {
  const min = toDisplayLength(minCm, unit);
  const max = toDisplayLength(maxCm, unit);
  const digits = unit === "cm" ? 0 : 1;
  return `${min.toFixed(digits)}–${max.toFixed(digits)} ${lengthSuffix(unit)}`;
}

/**
 * Render a canonical-kg range in the active display unit, same conventions
 * as `displayLengthRange`.
 */
export function displayWeightRange(
  minKg: number,
  maxKg: number,
  unit: WeightUnit,
): string {
  const min = toDisplayWeight(minKg, unit);
  const max = toDisplayWeight(maxKg, unit);
  const digits = unit === "kg" ? 0 : 1;
  return `${min.toFixed(digits)}–${max.toFixed(digits)} ${weightSuffix(unit)}`;
}

/**
 * Convert a string display value from one length unit to another, going
 * through the canonical cm representation. Returns the input unchanged if
 * it is empty or not a finite number, so the caller never has to special-
 * case in-progress typing like "" or "1.".
 */
export function convertLengthDisplayValue(
  raw: string,
  from: LengthUnit,
  to: LengthUnit,
  digits = 1,
): string {
  if (from === to) return raw;
  if (!raw.trim()) return raw;
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  const cm = fromDisplayLength(n, from);
  return toDisplayLength(cm, to).toFixed(digits);
}

/**
 * Same idea as `convertLengthDisplayValue` for weight values.
 */
export function convertWeightDisplayValue(
  raw: string,
  from: WeightUnit,
  to: WeightUnit,
  digits = 1,
): string {
  if (from === to) return raw;
  if (!raw.trim()) return raw;
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  const kg = fromDisplayWeight(n, from);
  return toDisplayWeight(kg, to).toFixed(digits);
}
