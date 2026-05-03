import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/db/db";
import { BUILT_IN_TYPES } from "@/db/builtIns";
import { syncEssentialData } from "@/services/bootstrapService";
import {
  BACKUP_SCHEMA_VERSION,
  clearAll,
  exportAll,
  importAll,
  importPrepared,
  tryPrepareImport,
  validateAndPrepareImport,
} from "@/services/exportImportService";

/** Minimal valid 1×1 PNG (base64). */
const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function resetDb(): Promise<void> {
  await db.delete();
  await db.open();
  await syncEssentialData();
}

describe("exportImportService", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("clearAll leaves profile, settings, and built-in measurement types", async () => {
    await db.checkins.add({
      id: "c1",
      recordedAt: Date.now(),
      dateKey: "2020-01-01",
      createdAt: 1,
      updatedAt: 1,
    });
    await clearAll();
    const profile = await db.profile.get("primary");
    const settings = await db.settings.get("local");
    const types = await db.measurementTypes.toArray();
    const checkins = await db.checkins.toArray();
    expect(profile).toBeDefined();
    expect(profile?.id).toBe("primary");
    expect(settings).toBeDefined();
    expect(settings?.id).toBe("local");
    expect(checkins).toHaveLength(0);
    expect(types.length).toBe(BUILT_IN_TYPES.length);
    for (const b of BUILT_IN_TYPES) {
      expect(types.some((t) => t.id === b.id)).toBe(true);
    }
  });

  it("round-trip export then import restores rows and photo blob", async () => {
    const now = Date.now();
    await db.profile.put({
      id: "primary",
      sex: "female",
      heightCm: 165,
      updatedAt: now,
    });
    await db.checkins.put({
      id: "chk-1",
      recordedAt: now,
      dateKey: "2024-06-15",
      weightKg: 62,
      createdAt: now,
      updatedAt: now,
    });
    const bin = atob(TINY_PNG_B64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: "image/png" });
    await db.photos.put({
      id: "ph-1",
      checkinId: "chk-1",
      recordedAt: now,
      dateKey: "2024-06-15",
      poseTag: "front",
      width: 1,
      height: 1,
      byteSize: blob.size,
      mimeType: "image/png",
      createdAt: now,
      caption: "hello",
      blob,
    });

    const json = await exportAll();
    await resetDb();

    await importAll(json);
    const photos = await db.photos.toArray();
    const profile = await db.profile.get("primary");
    const checkins = await db.checkins.toArray();
    expect(profile?.sex).toBe("female");
    expect(profile?.heightCm).toBe(165);
    expect(checkins).toHaveLength(1);
    expect(checkins[0]?.id).toBe("chk-1");
    expect(photos).toHaveLength(1);
    expect(photos[0]?.caption).toBe("hello");
    expect(photos[0]?.mimeType).toBe("image/png");
    expect(photos[0]?.byteSize).toBeGreaterThan(0);
  });

  it("importAll rejects invalid JSON without touching DB", async () => {
    await db.checkins.add({
      id: "keep-json",
      recordedAt: 1,
      dateKey: "2020-01-02",
      createdAt: 1,
      updatedAt: 1,
    });
    await expect(importAll("not json")).rejects.toThrow(/not valid JSON/i);
    expect(await db.checkins.count()).toBe(1);
  });

  it("tryPrepareImport rejects invalid JSON without touching DB", async () => {
    await db.checkins.add({
      id: "keep",
      recordedAt: 1,
      dateKey: "2020-01-02",
      createdAt: 1,
      updatedAt: 1,
    });
    const r = tryPrepareImport("not json {{{");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected fail");
    expect(r.message).toMatch(/not valid JSON/i);
    expect(await db.checkins.count()).toBe(1);
  });

  it("tryPrepareImport rejects malformed payload (missing keys)", async () => {
    await db.checkins.add({
      id: "keep",
      recordedAt: 1,
      dateKey: "2020-01-02",
      createdAt: 1,
      updatedAt: 1,
    });
    const r = tryPrepareImport(JSON.stringify({ schemaVersion: 1 }));
    expect(r.ok).toBe(false);
    expect(await db.checkins.count()).toBe(1);
  });

  it("validateAndPrepareImport rejects unsupported backup schemaVersion", () => {
    const bad = {
      schemaVersion: 99,
      exportedAt: 1,
      profile: [],
      settings: [],
      measurementTypes: [],
      checkins: [],
      measurements: [],
      photos: [],
    };
    expect(() => validateAndPrepareImport(JSON.stringify(bad))).toThrow(/format version 99/);
  });

  it("import does not clear DB when photo base64 is invalid", async () => {
    await db.checkins.add({
      id: "seed-row",
      recordedAt: 1,
      dateKey: "2020-01-03",
      createdAt: 1,
      updatedAt: 1,
    });
    const bad = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: 1,
      profile: [],
      settings: [],
      measurementTypes: [],
      checkins: [],
      measurements: [],
      photos: [
        {
          id: "p1",
          recordedAt: 1,
          poseTag: "front",
          width: 1,
          height: 1,
          byteSize: 10,
          mimeType: "image/png",
          createdAt: 1,
          blobBase64: "@@@not-base64@@@",
        },
      ],
    };
    await expect(importAll(JSON.stringify(bad))).rejects.toThrow(/invalid or corrupted/i);
    expect(await db.checkins.count()).toBe(1);
    expect(await db.checkins.get("seed-row")).toBeDefined();
  });

  it("importPrepared with empty payload still yields essentials after sync", async () => {
    const prep = validateAndPrepareImport(
      JSON.stringify({
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: 1,
        profile: [],
        settings: [],
        measurementTypes: [],
        checkins: [],
        measurements: [],
        photos: [],
      }),
    );
    await importPrepared(prep);
    expect(await db.profile.get("primary")).toBeDefined();
    expect(await db.settings.get("local")).toBeDefined();
    expect(await db.measurementTypes.count()).toBe(BUILT_IN_TYPES.length);
  });
});
