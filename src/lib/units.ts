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
