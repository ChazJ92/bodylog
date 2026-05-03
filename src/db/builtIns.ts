import type { Table } from "dexie";
import type { MeasurementType } from "./db";

/**
 * Canonical built-in measurement type definitions.
 *
 * Notes:
 * - `hips` (plural) is canonical; legacy `hip` (singular) is preserved on
 *   upgraded DBs but never seeded on a fresh DB.
 * - No generic `arm`, `thigh`, `calf`, or `leg` — only bilateral variants.
 * - `shoulders` and `abdomen` are first-class torso measurements alongside
 *   `chest` and `waist`.
 * - `sortOrder` is stable so display order remains predictable:
 *   neck → shoulders → chest → abdomen → waist → hips →
 *   left/right biceps → left/right thigh → left/right calf.
 */
export const BUILT_IN_TYPES: Omit<MeasurementType, "createdAt">[] = [
  { id: "neck",         name: "Neck",         unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 10 },
  { id: "shoulders",    name: "Shoulders",    unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 20 },
  { id: "chest",        name: "Chest",        unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 30 },
  { id: "abdomen",      name: "Abdomen",      unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 40 },
  { id: "waist",        name: "Waist",        unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 50 },
  { id: "hips",         name: "Hips",         unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 60 },
  { id: "left_biceps",  name: "Left Biceps",  unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 70 },
  { id: "right_biceps", name: "Right Biceps", unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 80 },
  { id: "left_thigh",   name: "Left Thigh",   unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 90 },
  { id: "right_thigh",  name: "Right Thigh",  unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 100 },
  { id: "left_calf",    name: "Left Calf",    unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 110 },
  { id: "right_calf",   name: "Right Calf",   unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 120 },
];

/**
 * Map of legacy generic ids to the canonical ids that, when present, should
 * shadow the legacy row from normal user-facing selection flows.
 *
 * Policy: a legacy id is hidden from selection only when at least one of its
 * canonical replacements is present in the DB. If none are present, the
 * legacy row is still surfaced so the user is never left with a measurement
 * type they cannot pick. This shadowing is purely cosmetic — legacy rows
 * remain in storage and historical data is never rewritten.
 */
export const LEGACY_SHADOWED_BY: Readonly<Record<string, readonly string[]>> = {
  hip: ["hips"],
  arm: ["left_biceps", "right_biceps"],
  leg: ["left_thigh", "right_thigh", "left_calf", "right_calf"],
  thigh: ["left_thigh", "right_thigh"],
  calf: ["left_calf", "right_calf"],
};

/**
 * Pure helper: filter a list of measurement types so that legacy generic
 * rows are hidden when their canonical replacements are also present.
 *
 * - Inputs are not mutated.
 * - Order is preserved (callers already sort by `sortOrder`).
 * - When no canonical replacement exists, the legacy row passes through
 *   unchanged so users with only-legacy databases keep their selections.
 */
export function filterLegacyShadowedTypes<T extends { id: string }>(types: readonly T[]): T[] {
  const presentIds = new Set(types.map((t) => t.id));
  return types.filter((t) => {
    const canonical = LEGACY_SHADOWED_BY[t.id];
    if (!canonical) return true;
    return !canonical.some((c) => presentIds.has(c));
  });
}

/**
 * Add only the canonical built-ins that are missing, keyed by canonical id.
 *
 * Never clears, never overwrites existing rows, never touches `measurements`.
 * Safe to run repeatedly. Legacy ambiguous built-ins (e.g. `hip`, `arm`,
 * `thigh`) are preserved untouched on upgraded databases — the canonical
 * sibling (e.g. `hips`) is still seeded if it is missing, so an upgraded DB
 * may legitimately contain both rows. Resolving which row is shown for new
 * entry is handled separately by `filterLegacyShadowedTypes`.
 *
 * The `measurementTypes` table is passed in so this module does not import
 * the Dexie instance, avoiding a circular import with `./db`.
 */
export async function ensureBuiltInMeasurementTypes(
  measurementTypes: Table<MeasurementType, string>,
): Promise<void> {
  const now = Date.now();
  const existingIds = new Set(
    (await measurementTypes.toArray()).map((t) => t.id),
  );
  const missing = BUILT_IN_TYPES
    .filter((t) => !existingIds.has(t.id))
    .map((t) => ({ ...t, createdAt: now }));
  if (missing.length > 0) {
    await measurementTypes.bulkPut(missing);
  }
}
