import { db, type Settings } from "@/db/db";
import { settingsUpdateSchema } from "@/lib/validationSchemas";

export const get = (): Promise<Settings | undefined> => db.settings.get("local");

export async function update(
  patch: Partial<Omit<Settings, "id" | "createdAt" | "updatedAt">>,
): Promise<void> {
  const parsed = settingsUpdateSchema.parse(patch);
  const now = Date.now();
  const existing: Settings = (await db.settings.get("local")) ?? {
    id: "local",
    weightUnit: "kg",
    lengthUnit: "cm",
    createdAt: now,
    updatedAt: now,
  };
  await db.settings.put({ ...existing, ...parsed, id: "local", updatedAt: now });
}
