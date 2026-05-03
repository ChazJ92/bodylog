import { db, type MeasurementType } from "@/db/db";
import { filterLegacyShadowedTypes } from "@/db/builtIns";
import { newId } from "@/lib/ids";

/**
 * Active types for normal user-facing selection (data entry, chart series,
 * etc.). Legacy generic rows (`hip`, `arm`, `leg`, `thigh`, `calf`) are
 * hidden when their canonical bilateral/plural replacements are present.
 *
 * Legacy rows remain in storage and continue to resolve by id for any
 * historical lookup paths — `listAll` still returns them so the management
 * UI in Settings can still see and toggle them, and any caller that needs
 * the full set for display purposes (e.g. resolving a historical
 * measurement's name) should use `listAll` instead.
 */
export const listActive = async (): Promise<MeasurementType[]> => {
  const active = await db.measurementTypes
    .filter((t) => t.isActive)
    .sortBy("sortOrder");
  return filterLegacyShadowedTypes(active);
};

export const listAll = () =>
  db.measurementTypes.orderBy("sortOrder").toArray();

/**
 * Normalize a user-entered name for storage AND comparison:
 * - trim leading/trailing whitespace
 * - collapse internal runs of whitespace to a single space
 *
 * Names are compared case-insensitively. Stored names preserve the user's
 * casing but use the collapsed-whitespace form so that "  Left   Calf  "
 * and "left calf" cannot coexist.
 */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

async function ensureUniqueName(name: string, excludeId?: string): Promise<void> {
  const normalized = normalizeName(name);
  if (!normalized) throw new Error("Name required");
  const key = normalized.toLowerCase();
  const all = await db.measurementTypes.toArray();
  const dup = all.find(
    (t) => t.id !== excludeId && normalizeName(t.name).toLowerCase() === key,
  );
  if (dup) {
    throw new Error(`A measurement type named "${dup.name}" already exists`);
  }
}

export async function createType(name: string): Promise<MeasurementType> {
  const normalized = normalizeName(name);
  if (!normalized) throw new Error("Name required");
  await ensureUniqueName(normalized);
  const all = await db.measurementTypes.toArray();
  const maxSort = all.reduce((m, t) => Math.max(m, t.sortOrder), 0);
  const t: MeasurementType = {
    id: newId(),
    name: normalized,
    unit: "cm",
    isBuiltIn: false,
    isActive: true,
    sortOrder: maxSort + 10,
    createdAt: Date.now(),
  };
  await db.measurementTypes.put(t);
  return t;
}

export async function renameType(id: string, name: string): Promise<void> {
  const normalized = normalizeName(name);
  if (!normalized) throw new Error("Name required");
  await ensureUniqueName(normalized, id);
  // Rename only — never touch the id (built-in ids must be preserved so that
  // existing measurements keep resolving to the right type).
  await db.measurementTypes.update(id, { name: normalized });
}

export async function setActive(id: string, isActive: boolean): Promise<void> {
  // Soft-disable only; we never hard-delete measurement types so that
  // historical measurements keep resolving to a valid type row.
  await db.measurementTypes.update(id, { isActive });
}
