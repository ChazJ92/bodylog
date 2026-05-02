import type { Table } from "dexie";
import type { MeasurementType } from "./db";

/**
 * Canonical Phase 1 built-in measurement type definitions.
 *
 * Notes:
 * - `hips` (plural) is canonical; legacy `hip` (singular) is preserved on
 *   upgraded DBs but never seeded on a fresh DB.
 * - No generic `arm`, `thigh`, or `leg` — only bilateral variants.
 * - `sortOrder` is stable so display order remains predictable.
 */
export const BUILT_IN_TYPES: Omit<MeasurementType, "createdAt">[] = [
  { id: "neck",         name: "Neck",         unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 10 },
  { id: "chest",        name: "Chest",        unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 20 },
  { id: "waist",        name: "Waist",        unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 30 },
  { id: "hips",         name: "Hips",         unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 40 },
  { id: "left_biceps",  name: "Left Biceps",  unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 50 },
  { id: "right_biceps", name: "Right Biceps", unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 60 },
  { id: "left_thigh",   name: "Left Thigh",   unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 70 },
  { id: "right_thigh",  name: "Right Thigh",  unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 80 },
  { id: "left_calf",    name: "Left Calf",    unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 90 },
  { id: "right_calf",   name: "Right Calf",   unit: "cm", isBuiltIn: true, isActive: true, sortOrder: 100 },
];

/**
 * Add only the canonical built-ins that are missing, keyed by canonical id.
 *
 * Never clears, never overwrites existing rows, never touches `measurements`.
 * Safe to run repeatedly. Legacy ambiguous built-ins (e.g. `hip`, `arm`,
 * `thigh`) are preserved untouched on upgraded databases — the canonical
 * sibling (e.g. `hips`) is still seeded if it is missing, so an upgraded DB
 * may legitimately contain both rows. Resolving the read path between legacy
 * and canonical ids is intentionally out of scope here.
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
