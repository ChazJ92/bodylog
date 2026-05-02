/**
 * Phase 1 (Dexie schema v2) — data layer only.
 *
 * Transitional shape until Phase 2:
 * - `Profile.id` and `Settings.id` are unions of new + legacy literals so the
 *   existing services in src/services/ keep type-checking without edits in
 *   this phase. Phase 2 will narrow them to "primary" / "local".
 * - `Checkin.dateKey` and `Photo.dateKey` are optional so existing service
 *   writes that don't yet populate them keep type-checking. Phase 2 will
 *   make them required and update the writers.
 *
 * Migration policy:
 * - Schema v1 is preserved untouched.
 * - The v2 upgrade is non-destructive: it merges legacy singletons into the
 *   new ids, backfills `dateKey`, and creates/bumps the `appMeta` row.
 * - Built-in measurement types are seeded missing-only on existing DBs so
 *   legacy ambiguous types (`hip`, `arm`, `thigh`) are preserved.
 */
import Dexie, { type Table, type Transaction } from "dexie";
import { dateKeyFromRecordedAt } from "./dateKey";
import { BUILT_IN_TYPES, ensureBuiltInMeasurementTypes } from "./builtIns";

export type Sex = "male" | "female" | "other";
export type WeightUnit = "kg" | "lb";
export type LengthUnit = "cm" | "in";

export interface Profile {
  // Transitional union (Phase 1). Phase 2 will narrow to "primary".
  id: "primary" | "me";
  sex: Sex;
  heightCm?: number;
  birthYear?: number;
  updatedAt: number;
}

export interface Settings {
  // Transitional union (Phase 1). Phase 2 will narrow to "local".
  id: "local" | "app";
  weightUnit: WeightUnit;
  lengthUnit: LengthUnit;
  createdAt: number;
  updatedAt: number;
}

export interface AppMeta {
  id: "meta";
  schemaVersion: number;
}

export interface Checkin {
  id: string;
  recordedAt: number; // ms since epoch
  // Phase 1: optional. Phase 2 will make required and have services populate.
  dateKey?: string;
  weightKg?: number;
  bodyFatPct?: number; // user-entered, 0-100
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MeasurementType {
  id: string;
  name: string; // e.g. "waist"
  unit: "cm"; // canonical
  isBuiltIn: boolean;
  isActive: boolean; // soft-delete via false
  sortOrder: number;
  createdAt: number;
}

export interface Measurement {
  id: string;
  checkinId: string;
  measurementTypeId: string;
  valueCm: number;
  recordedAt: number; // mirrors checkin for fast querying
  createdAt: number;
}

export type PoseTag = "front" | "side" | "back" | "other";

export interface Photo {
  id: string;
  checkinId?: string;
  recordedAt: number;
  // Phase 1: optional. Phase 2 will make required and have services populate.
  dateKey?: string;
  poseTag: PoseTag;
  blob: Blob;
  width: number;
  height: number;
  byteSize: number;
  mimeType: string;
  // Phase 1 additive field; not yet written by services.
  caption?: string;
  createdAt: number;
}

class BodyTrackDB extends Dexie {
  profile!: Table<Profile, "primary" | "me">;
  settings!: Table<Settings, "local" | "app">;
  appMeta!: Table<AppMeta, "meta">;
  checkins!: Table<Checkin, string>;
  measurementTypes!: Table<MeasurementType, string>;
  measurements!: Table<Measurement, string>;
  photos!: Table<Photo, string>;

  constructor() {
    super("body-track");
    // v1: original schema — unchanged so existing user DBs upgrade cleanly.
    this.version(1).stores({
      profile: "id, updatedAt",
      settings: "id, updatedAt",
      checkins: "id, recordedAt, createdAt",
      measurementTypes: "id, name, isActive, sortOrder",
      measurements: "id, checkinId, measurementTypeId, recordedAt, [measurementTypeId+recordedAt]",
      photos: "id, checkinId, recordedAt, poseTag",
    });
    // v2: add appMeta, dateKey indexes on checkins/photos.
    // All v1 indexes are retained so existing queries keep working in this
    // phase (no dependent query updates allowed in Phase 1).
    this.version(2)
      .stores({
        appMeta: "id",
        profile: "id, updatedAt",
        settings: "id, updatedAt",
        checkins: "id, recordedAt, dateKey, createdAt",
        measurementTypes: "id, name, isActive, sortOrder",
        measurements: "id, checkinId, measurementTypeId, recordedAt, [measurementTypeId+recordedAt]",
        photos: "id, checkinId, recordedAt, dateKey, poseTag",
      })
      .upgrade(upgradeV1ToV2);
  }
}

export const db = new BodyTrackDB();

// ---------------------------------------------------------------------------
// Schema v1 -> v2 upgrade (non-destructive)
// ---------------------------------------------------------------------------

/**
 * Number of "meaningful" (user-customized, non-default) fields on a profile
 * row. Used as a tiebreaker so the migration never silently discards the only
 * row containing real user data.
 */
function profileMeaningfulCount(p: Partial<Profile> | undefined): number {
  if (!p) return 0;
  let c = 0;
  if (p.sex && p.sex !== "other") c++;
  if (typeof p.heightCm === "number") c++;
  if (typeof p.birthYear === "number") c++;
  return c;
}

function settingsMeaningfulCount(s: Partial<Settings> | undefined): number {
  if (!s) return 0;
  let c = 0;
  if (s.weightUnit && s.weightUnit !== "kg") c++;
  if (s.lengthUnit && s.lengthUnit !== "cm") c++;
  return c;
}

/**
 * Pick a winner between two singleton rows when both legacy and new ids exist.
 * Order of preference:
 *   1. The only row with meaningful data wins (never discard real user data).
 *   2. Newer `updatedAt` wins.
 *   3. More-complete row wins.
 *   4. Stable fallback to `b` (the new-id row) when fully tied.
 */
function pickSingletonWinner<T extends { updatedAt?: number }>(
  a: T,
  b: T,
  meaningful: (row: T) => number,
): T {
  const ma = meaningful(a);
  const mb = meaningful(b);
  if (ma > 0 && mb === 0) return a;
  if (mb > 0 && ma === 0) return b;
  const ta = typeof a.updatedAt === "number" ? a.updatedAt : -Infinity;
  const tb = typeof b.updatedAt === "number" ? b.updatedAt : -Infinity;
  if (ta !== tb) return ta > tb ? a : b;
  if (ma !== mb) return ma > mb ? a : b;
  return b;
}

async function migrateSingleton<T extends { updatedAt?: number }>(
  tx: Transaction,
  tableName: "profile" | "settings",
  oldId: string,
  newId: string,
  meaningful: (row: T) => number,
): Promise<void> {
  const table = tx.table<T>(tableName);
  const [oldRow, newRow] = await Promise.all([
    table.get(oldId),
    table.get(newId),
  ]);

  if (!oldRow && !newRow) return;

  if (oldRow && !newRow) {
    await table.put({ ...oldRow, id: newId } as T & { id: string });
    await table.delete(oldId);
    return;
  }

  if (!oldRow && newRow) return;

  // Both exist — resolve conflict.
  const winner = pickSingletonWinner(oldRow as T, newRow as T, meaningful);
  await table.put({ ...winner, id: newId } as T & { id: string });
  await table.delete(oldId);
}

async function upgradeV1ToV2(tx: Transaction): Promise<void> {
  // 1. Profile singleton: "me" -> "primary"
  await migrateSingleton<Profile>(tx, "profile", "me", "primary", profileMeaningfulCount);

  // 2. Settings singleton: "app" -> "local"
  await migrateSingleton<Settings>(tx, "settings", "app", "local", settingsMeaningfulCount);

  // 3. Backfill dateKey on checkins (idempotent: only when missing).
  await tx.table("checkins").toCollection().modify((c: Checkin) => {
    if (!c.dateKey && typeof c.recordedAt === "number") {
      c.dateKey = dateKeyFromRecordedAt(c.recordedAt);
    }
  });

  // 4. Backfill dateKey on photos (idempotent: only when missing).
  await tx.table("photos").toCollection().modify((p: Photo) => {
    if (!p.dateKey && typeof p.recordedAt === "number") {
      p.dateKey = dateKeyFromRecordedAt(p.recordedAt);
    }
  });

  // 5. Create-or-bump appMeta row to schemaVersion 2.
  const metaTable = tx.table<AppMeta>("appMeta");
  const meta = await metaTable.get("meta");
  if (!meta) {
    await metaTable.put({ id: "meta", schemaVersion: 2 });
  } else if (typeof meta.schemaVersion !== "number" || meta.schemaVersion < 2) {
    await metaTable.put({ ...meta, id: "meta", schemaVersion: 2 });
  }

  // 6. Measurement types are intentionally not modified here. Legacy ids
  //    (hip, arm, thigh, etc.) are preserved; ensureSeeded() will additively
  //    add any missing canonical built-ins after the upgrade completes.
}

// ---------------------------------------------------------------------------
// Seeding (runs once per app load, after upgrades)
// ---------------------------------------------------------------------------

let seedPromise: Promise<void> | null = null;
export function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const now = Date.now();

      const settings = await db.settings.get("local");
      if (!settings) {
        await db.settings.put({
          id: "local",
          weightUnit: "kg",
          lengthUnit: "cm",
          createdAt: now,
          updatedAt: now,
        });
      }

      const profile = await db.profile.get("primary");
      if (!profile) {
        await db.profile.put({ id: "primary", sex: "other", updatedAt: now });
      }

      // Note: until Phase 2 fixes the writers, legacy services may still
      // create or reference old singleton ids (`me` / `app`). That is a
      // tolerated temporary compatibility state for this phase only and is
      // not the final solution.

      const typeCount = await db.measurementTypes.count();
      if (typeCount === 0) {
        // Fast path: fresh DB gets exactly the canonical Phase 1 set.
        await db.measurementTypes.bulkPut(
          BUILT_IN_TYPES.map((t) => ({ ...t, createdAt: now })),
        );
      } else {
        // Existing DB: additively add only canonical built-ins that are
        // missing. Never wipes, never overwrites legacy rows.
        await ensureBuiltInMeasurementTypes(db.measurementTypes);
      }

      const meta = await db.appMeta.get("meta");
      if (!meta) {
        await db.appMeta.put({ id: "meta", schemaVersion: 2 });
      } else if (typeof meta.schemaVersion !== "number" || meta.schemaVersion < 2) {
        await db.appMeta.put({ ...meta, id: "meta", schemaVersion: 2 });
      }
    })();
  }
  return seedPromise;
}
