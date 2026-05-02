import { db, type MeasurementType } from "@/db/db";
import { newId } from "@/lib/ids";

export const listActive = () =>
  db.measurementTypes.filter((t) => t.isActive).sortBy("sortOrder");

export const listAll = () =>
  db.measurementTypes.orderBy("sortOrder").toArray();

export async function createType(name: string): Promise<MeasurementType> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name required");
  const all = await db.measurementTypes.toArray();
  const maxSort = all.reduce((m, t) => Math.max(m, t.sortOrder), 0);
  const t: MeasurementType = {
    id: newId(),
    name: trimmed,
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
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name required");
  await db.measurementTypes.update(id, { name: trimmed });
}

export async function setActive(id: string, isActive: boolean): Promise<void> {
  await db.measurementTypes.update(id, { isActive });
}
