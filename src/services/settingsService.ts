import { db, type Settings } from "@/db/db";

export const get = (): Promise<Settings | undefined> => db.settings.get("app");

export async function update(patch: Partial<Omit<Settings, "id" | "createdAt" | "updatedAt">>): Promise<void> {
  const existing = await db.settings.get("app");
  const now = Date.now();
  const base: Settings = existing ?? {
    id: "app",
    weightUnit: "kg",
    lengthUnit: "cm",
    createdAt: now,
    updatedAt: now,
  };
  await db.settings.put({ ...base, ...patch, id: "app", updatedAt: now });
}
