export const RANGES = {
  weightKg: { min: 20, max: 400 },
  heightCm: { min: 100, max: 250 },
  bodyFatPct: { min: 1, max: 75 },
  measurementCm: { min: 1, max: 300 },
};

export function inRange(v: number, r: { min: number; max: number }): boolean {
  return Number.isFinite(v) && v >= r.min && v <= r.max;
}
