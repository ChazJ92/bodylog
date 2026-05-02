import { db, type Profile } from "@/db/db";
import { profileUpdateSchema } from "@/lib/validationSchemas";

export const get = (): Promise<Profile | undefined> => db.profile.get("primary");

export async function update(
  patch: Partial<Omit<Profile, "id" | "updatedAt">>,
): Promise<void> {
  const parsed = profileUpdateSchema.parse(patch);
  const now = Date.now();
  const existing: Profile = (await db.profile.get("primary")) ?? {
    id: "primary",
    sex: "other",
    updatedAt: now,
  };
  await db.profile.put({ ...existing, ...parsed, id: "primary", updatedAt: now });
}
