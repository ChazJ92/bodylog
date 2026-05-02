import { db, type Measurement } from "@/db/db";
import { newId } from "@/lib/ids";

export const listByCheckin = (checkinId: string) =>
  db.measurements.where("checkinId").equals(checkinId).toArray();

export const historyForType = (measurementTypeId: string) =>
  db.measurements
    .where("[measurementTypeId+recordedAt]")
    .between([measurementTypeId, 0], [measurementTypeId, Number.MAX_SAFE_INTEGER])
    .toArray();

export async function latestForType(measurementTypeId: string): Promise<Measurement | undefined> {
  const arr = await historyForType(measurementTypeId);
  arr.sort((a, b) => b.recordedAt - a.recordedAt);
  return arr[0];
}

export async function upsertForCheckin(
  checkinId: string,
  recordedAt: number,
  measurementTypeId: string,
  valueCm: number | undefined,
): Promise<void> {
  const existing = await db.measurements
    .where("checkinId").equals(checkinId)
    .and((m) => m.measurementTypeId === measurementTypeId)
    .first();
  if (valueCm == null || !Number.isFinite(valueCm)) {
    if (existing) await db.measurements.delete(existing.id);
    return;
  }
  if (existing) {
    await db.measurements.put({ ...existing, valueCm, recordedAt });
  } else {
    await db.measurements.put({
      id: newId(),
      checkinId,
      measurementTypeId,
      valueCm,
      recordedAt,
      createdAt: Date.now(),
    });
  }
}
