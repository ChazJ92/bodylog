import { db, type Checkin } from "@/db/db";
import { newId } from "@/lib/ids";

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
  const now = Date.now();
  const checkin: Checkin = {
    id: newId(),
    recordedAt: input.recordedAt,
    weightKg: input.weightKg,
    bodyFatPct: input.bodyFatPct,
    notes: input.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  await db.checkins.put(checkin);
  return checkin;
}

export async function updateCheckin(id: string, patch: Partial<CheckinInput>): Promise<void> {
  const existing = await db.checkins.get(id);
  if (!existing) throw new Error("Check-in not found");
  await db.checkins.put({
    ...existing,
    ...patch,
    notes: patch.notes !== undefined ? patch.notes.trim() || undefined : existing.notes,
    updatedAt: Date.now(),
  });
  // mirror recordedAt onto measurements
  if (patch.recordedAt && patch.recordedAt !== existing.recordedAt) {
    const ms = await db.measurements.where("checkinId").equals(id).toArray();
    await db.measurements.bulkPut(ms.map((m) => ({ ...m, recordedAt: patch.recordedAt! })));
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
