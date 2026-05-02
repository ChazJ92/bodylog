import { z } from "zod";
import { db } from "@/db/db";

const SCHEMA_VERSION = 1;

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
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

const exportSchema = z.object({
  schemaVersion: z.number(),
  exportedAt: z.number(),
  profile: z.array(z.any()),
  settings: z.array(z.any()),
  measurementTypes: z.array(z.any()),
  checkins: z.array(z.any()),
  measurements: z.array(z.any()),
  photos: z.array(
    z.object({
      id: z.string(),
      checkinId: z.string().optional(),
      recordedAt: z.number(),
      poseTag: z.string(),
      width: z.number(),
      height: z.number(),
      byteSize: z.number(),
      mimeType: z.string(),
      createdAt: z.number(),
      blobBase64: z.string(),
    }),
  ),
});

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
    schemaVersion: SCHEMA_VERSION,
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

export async function importAll(json: string): Promise<{ replaced: boolean }> {
  const raw = JSON.parse(json);
  const parsed = exportSchema.parse(raw);
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version: ${parsed.schemaVersion}`);
  }
  await db.transaction(
    "rw",
    db.profile,
    db.settings,
    db.measurementTypes,
    db.checkins,
    db.measurements,
    db.photos,
    async () => {
      await Promise.all([
        db.profile.clear(),
        db.settings.clear(),
        db.measurementTypes.clear(),
        db.checkins.clear(),
        db.measurements.clear(),
        db.photos.clear(),
      ]);
      if (parsed.profile.length) await db.profile.bulkPut(parsed.profile as never);
      if (parsed.settings.length) await db.settings.bulkPut(parsed.settings as never);
      if (parsed.measurementTypes.length) await db.measurementTypes.bulkPut(parsed.measurementTypes as never);
      if (parsed.checkins.length) await db.checkins.bulkPut(parsed.checkins as never);
      if (parsed.measurements.length) await db.measurements.bulkPut(parsed.measurements as never);
      if (parsed.photos.length) {
        const restored = parsed.photos.map((p) => ({
          id: p.id,
          checkinId: p.checkinId,
          recordedAt: p.recordedAt,
          poseTag: p.poseTag as never,
          width: p.width,
          height: p.height,
          byteSize: p.byteSize,
          mimeType: p.mimeType,
          createdAt: p.createdAt,
          blob: base64ToBlob(p.blobBase64, p.mimeType),
        }));
        await db.photos.bulkPut(restored as never);
      }
    },
  );
  return { replaced: true };
}

export async function clearAll(): Promise<void> {
  await db.transaction(
    "rw",
    db.profile,
    db.settings,
    db.measurementTypes,
    db.checkins,
    db.measurements,
    db.photos,
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
}
