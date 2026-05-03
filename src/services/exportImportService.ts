import { prettifyError, z } from "zod";
import {
  db,
  type Checkin,
  type Measurement,
  type MeasurementType,
  type Photo,
  type Profile,
  type Settings,
} from "@/db/db";
import { dateKeyFromRecordedAt } from "@/db/dateKey";
import { syncEssentialData } from "@/services/bootstrapService";

/** Export / import document version (not Dexie appMeta schemaVersion). */
export const BACKUP_SCHEMA_VERSION = 1;

async function blobToBase64(blob: Blob): Promise<string> {
  const ab =
    typeof blob.arrayBuffer === "function"
      ? await blob.arrayBuffer()
      : await new Response(blob).arrayBuffer();
  const buf = new Uint8Array(ab);
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin);
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function decodePhotoBlob(photoId: string, b64: string, mimeType: string): Blob {
  try {
    return base64ToBlob(b64, mimeType);
  } catch {
    throw new Error(
      `Photo "${photoId}": invalid or corrupted image data (could not decode).`,
    );
  }
}

const sexSchema = z.enum(["male", "female", "other"]);
const poseTagSchema = z.enum(["front", "side", "back", "other"]);

const profileRowSchema = z
  .object({
    id: z.enum(["primary", "me"]),
    sex: sexSchema,
    heightCm: z.number().finite().optional(),
    birthYear: z.number().int().finite().optional(),
    updatedAt: z.number().finite(),
  })
  .passthrough()
  .transform((r) => ({ ...r, id: "primary" as const }));

const settingsRowSchema = z
  .object({
    id: z.enum(["local", "app"]),
    weightUnit: z.enum(["kg", "lb"]),
    lengthUnit: z.enum(["cm", "in"]),
    createdAt: z.number().finite(),
    updatedAt: z.number().finite(),
  })
  .passthrough()
  .transform((r) => ({ ...r, id: "local" as const }));

const measurementTypeRowSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    unit: z.literal("cm"),
    isBuiltIn: z.boolean(),
    isActive: z.boolean(),
    sortOrder: z.number().finite(),
    createdAt: z.number().finite(),
  })
  .passthrough();

const checkinRowSchema = z
  .object({
    id: z.string().min(1),
    recordedAt: z.number().finite(),
    dateKey: z.string().min(1).optional(),
    weightKg: z.number().finite().optional(),
    bodyFatPct: z.number().finite().optional(),
    notes: z.string().optional(),
    createdAt: z.number().finite(),
    updatedAt: z.number().finite(),
  })
  .passthrough();

const measurementRowSchema = z
  .object({
    id: z.string().min(1),
    checkinId: z.string().min(1),
    measurementTypeId: z.string().min(1),
    valueCm: z.number().finite(),
    recordedAt: z.number().finite(),
    createdAt: z.number().finite(),
  })
  .passthrough();

const photoWireRowSchema = z
  .object({
    id: z.string().min(1),
    checkinId: z.string().optional(),
    recordedAt: z.number().finite(),
    poseTag: poseTagSchema,
    width: z.number().finite(),
    height: z.number().finite(),
    byteSize: z.number().finite(),
    mimeType: z.string().min(1),
    createdAt: z.number().finite(),
    blobBase64: z.string().min(1),
    caption: z.string().optional(),
    dateKey: z.string().optional(),
  })
  .passthrough();

const backupPayloadSchema = z
  .object({
    schemaVersion: z.number().finite(),
    exportedAt: z.number().finite(),
    profile: z.array(profileRowSchema),
    settings: z.array(settingsRowSchema),
    measurementTypes: z.array(measurementTypeRowSchema),
    checkins: z.array(checkinRowSchema),
    measurements: z.array(measurementRowSchema),
    photos: z.array(photoWireRowSchema),
  })
  .strict();

export type ImportSummary = {
  schemaVersion: number;
  exportedAt: number;
  profileRows: number;
  settingsRows: number;
  measurementTypesRows: number;
  checkinsRows: number;
  measurementsRows: number;
  photosRows: number;
};

export type PreparedImport = {
  summary: ImportSummary;
  profile: Profile[];
  settings: Settings[];
  measurementTypes: MeasurementType[];
  checkins: Checkin[];
  measurements: Measurement[];
  photos: Photo[];
};

function buildSummary(parsed: z.output<typeof backupPayloadSchema>): ImportSummary {
  return {
    schemaVersion: parsed.schemaVersion,
    exportedAt: parsed.exportedAt,
    profileRows: parsed.profile.length,
    settingsRows: parsed.settings.length,
    measurementTypesRows: parsed.measurementTypes.length,
    checkinsRows: parsed.checkins.length,
    measurementsRows: parsed.measurements.length,
    photosRows: parsed.photos.length,
  };
}

/** JSON.parse + Zod + full photo decode. Does not touch the database. Throws Error with a clear message. */
export function validateAndPrepareImport(json: string): PreparedImport {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error(
      "This file is not valid JSON. Use a backup exported from this app, or fix the file in a text editor.",
    );
  }

  const zod = backupPayloadSchema.safeParse(raw);
  if (!zod.success) {
    throw new Error(`Backup is invalid or incomplete:\n${prettifyError(zod.error)}`);
  }

  const parsed = zod.data;
  if (parsed.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(
      `This backup uses format version ${parsed.schemaVersion}; this app only supports version ${BACKUP_SCHEMA_VERSION}. Update the app or restore on a compatible version.`,
    );
  }

  const profile = parsed.profile as Profile[];
  const settings = parsed.settings as Settings[];

  const measurementTypes = parsed.measurementTypes as MeasurementType[];

  const checkins: Checkin[] = parsed.checkins.map((c) => ({
    ...c,
    dateKey:
      typeof c.dateKey === "string" && c.dateKey
        ? c.dateKey
        : dateKeyFromRecordedAt(c.recordedAt),
  })) as Checkin[];

  const measurements = parsed.measurements as Measurement[];

  const photos: Photo[] = [];
  for (const p of parsed.photos) {
    const blob = decodePhotoBlob(p.id, p.blobBase64, p.mimeType);
    const dateKey =
      typeof p.dateKey === "string" && p.dateKey
        ? p.dateKey
        : dateKeyFromRecordedAt(p.recordedAt);
    const row: Photo = {
      id: p.id,
      recordedAt: p.recordedAt,
      dateKey,
      poseTag: p.poseTag,
      width: p.width,
      height: p.height,
      byteSize: p.byteSize,
      mimeType: p.mimeType,
      createdAt: p.createdAt,
      blob,
    };
    if (p.checkinId !== undefined) row.checkinId = p.checkinId;
    if (p.caption !== undefined) row.caption = p.caption;
    photos.push(row);
  }

  return {
    summary: buildSummary(parsed),
    profile,
    settings,
    measurementTypes,
    checkins,
    measurements,
    photos,
  };
}

export function tryPrepareImport(
  json: string,
): { ok: true; data: PreparedImport } | { ok: false; message: string } {
  try {
    return { ok: true, data: validateAndPrepareImport(json) };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function exportAll(): Promise<string> {
  const [profile, settings, measurementTypes, checkins, measurements, photos] =
    await Promise.all([
      db.profile.toArray(),
      db.settings.toArray(),
      db.measurementTypes.toArray(),
      db.checkins.toArray(),
      db.measurements.toArray(),
      db.photos.toArray(),
    ]);
  const photosOut = await Promise.all(
    photos.map(async (p) => {
      const { blob, ...rest } = p;
      return { ...rest, blobBase64: await blobToBase64(blob) };
    }),
  );
  const payload = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: Date.now(),
    profile,
    settings,
    measurementTypes,
    checkins,
    measurements,
    photos: photosOut,
  };
  return JSON.stringify(payload, null, 2);
}

/** Replace all user tables with prepared rows, then ensure defaults exist. */
export async function importPrepared(prepared: PreparedImport): Promise<{ replaced: boolean }> {
  const {
    profile,
    settings,
    measurementTypes,
    checkins,
    measurements,
    photos,
  } = prepared;

  await db.transaction(
    "rw",
    [db.profile, db.settings, db.measurementTypes, db.checkins, db.measurements, db.photos],
    async () => {
      await Promise.all([
        db.profile.clear(),
        db.settings.clear(),
        db.measurementTypes.clear(),
        db.checkins.clear(),
        db.measurements.clear(),
        db.photos.clear(),
      ]);

      if (measurementTypes.length) await db.measurementTypes.bulkPut(measurementTypes);
      if (checkins.length) await db.checkins.bulkPut(checkins);
      if (measurements.length) await db.measurements.bulkPut(measurements);
      if (photos.length) await db.photos.bulkPut(photos);
      if (profile.length) await db.profile.bulkPut(profile);
      if (settings.length) await db.settings.bulkPut(settings);
    },
  );

  await syncEssentialData();
  return { replaced: true };
}

export async function importAll(json: string): Promise<{ replaced: boolean }> {
  const prepared = validateAndPrepareImport(json);
  return importPrepared(prepared);
}

export async function clearAll(): Promise<void> {
  await db.transaction(
    "rw",
    [db.profile, db.settings, db.measurementTypes, db.checkins, db.measurements, db.photos],
    async () => {
      await Promise.all([
        db.profile.clear(),
        db.settings.clear(),
        db.measurementTypes.clear(),
        db.checkins.clear(),
        db.measurements.clear(),
        db.photos.clear(),
      ]);
    },
  );
  await syncEssentialData();
}
