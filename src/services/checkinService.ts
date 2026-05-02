import { db, type Checkin } from "@/db/db";
import { dateKeyFromRecordedAt } from "@/db/dateKey";
import { newId } from "@/lib/ids";
import { checkinPatchSchema, checkinPayloadSchema } from "@/lib/validationSchemas";

export type CheckinInput = {
  recordedAt: number;
  weightKg?: number;
  bodyFatPct?: number;
  notes?: string;
};

export const listRecent = (limit = 50) =>
  db.checkins.orderBy("recordedAt").reverse().limit(limit).toArray();

export const listAll = () =>
  db.checkins.orderBy("recordedAt").reverse().toArray();

export const getLatest = () =>
  db.checkins.orderBy("recordedAt").reverse().first();

export const getById = (id: string) => db.checkins.get(id);

export async function createCheckin(input: CheckinInput): Promise<Checkin> {
  const parsed = checkinPayloadSchema.parse(input);
  const now = Date.now();
  const checkin: Checkin = {
    id: newId(),
    recordedAt: parsed.recordedAt,
    dateKey: dateKeyFromRecordedAt(parsed.recordedAt),
    weightKg: parsed.weightKg,
    bodyFatPct: parsed.bodyFatPct,
    notes: parsed.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  await db.checkins.put(checkin);
  return checkin;
}

export async function updateCheckin(id: string, patch: Partial<CheckinInput>): Promise<void> {
  const parsed = checkinPatchSchema.parse(patch);
  const existing = await db.checkins.get(id);
  if (!existing) throw new Error("Check-in not found");

  const recordedAtChanged =
    parsed.recordedAt !== undefined && parsed.recordedAt !== existing.recordedAt;
  const nextRecordedAt = parsed.recordedAt ?? existing.recordedAt;

  const next: Checkin = {
    ...existing,
    ...parsed,
    recordedAt: nextRecordedAt,
    // Keep dateKey consistent with recordedAt whenever it changes.
    dateKey: recordedAtChanged
      ? dateKeyFromRecordedAt(nextRecordedAt)
      : existing.dateKey,
    notes:
      parsed.notes !== undefined
        ? parsed.notes.trim() || undefined
        : existing.notes,
    updatedAt: Date.now(),
  };
  await db.checkins.put(next);

  // Mirror recordedAt onto measurements when it changed.
  if (recordedAtChanged) {
    const ms = await db.measurements.where("checkinId").equals(id).toArray();
    await db.measurements.bulkPut(ms.map((m) => ({ ...m, recordedAt: nextRecordedAt })));
  }
}

export async function deleteCheckin(id: string): Promise<void> {
  await db.transaction("rw", db.checkins, db.measurements, db.photos, async () => {
    await db.measurements.where("checkinId").equals(id).delete();
    const photos = await db.photos.where("checkinId").equals(id).toArray();
    for (const p of photos) {
      await db.photos.update(p.id, { checkinId: undefined });
    }
    await db.checkins.delete(id);
  });
}

export async function getPrevious(beforeTs: number): Promise<Checkin | undefined> {
  return db.checkins.where("recordedAt").below(beforeTs).reverse().sortBy("recordedAt").then((arr) => arr[0]);
}
