import { db, type Settings } from "@/db/db";

export const get = (): Promise<Settings | undefined> => db.settings.get("local");

export async function update(patch: Partial<Omit<Settings, "id" | "createdAt" | "updatedAt">>): Promise<void> {
  const existing = await db.settings.get("local");
  const now = Date.now();
  const base: Settings = existing ?? {
    id: "local",
    weightUnit: "kg",
    lengthUnit: "cm",
    createdAt: now,
    updatedAt: now,
  };
  await db.settings.put({ ...base, ...patch, id: "local", updatedAt: now });
}
