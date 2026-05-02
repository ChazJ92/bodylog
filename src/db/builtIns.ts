import { db, type MeasurementType } from "./db";

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
 * Map of canonical built-in id -> legacy id that semantically represents the
 * same measurement. When the legacy id already exists in a user database, we
 * skip seeding the canonical row so the UI does not show two equivalent
 * "Hip"/"Hips" entries. The analysis read path is responsible for resolving
 * the canonical id first and falling back to the legacy id.
 *
 * Bilateral additions (`left_biceps`/`right_biceps`/`left_thigh`/etc.) are
 * intentionally NOT aliased to the legacy generic `arm`/`thigh` because the
 * bilateral split is a feature, not a rename — having both is desirable.
 */
const LEGACY_ALIASES: Record<string, string> = {
  hips: "hip",
};

/**
 * Add only the canonical built-ins that are missing.
 *
 * Never clears, never overwrites existing rows, never touches `measurements`.
 * Safe to run repeatedly. Preserves legacy ambiguous built-ins (e.g. `hip`,
 * `arm`, `thigh`) when present on upgraded databases. Skips canonical rows
 * whose legacy alias already exists (see `LEGACY_ALIASES`).
 */
export async function ensureBuiltInMeasurementTypes(): Promise<void> {
  const now = Date.now();
  const existingIds = new Set(
    (await db.measurementTypes.toArray()).map((t) => t.id),
  );
  const missing = BUILT_IN_TYPES.filter((t) => {
    if (existingIds.has(t.id)) return false;
    const legacy = LEGACY_ALIASES[t.id];
    if (legacy && existingIds.has(legacy)) return false;
    return true;
  }).map((t) => ({ ...t, createdAt: now }));
  if (missing.length > 0) {
    await db.measurementTypes.bulkPut(missing);
  }
}
