import { db, type Profile } from "@/db/db";

export const get = (): Promise<Profile | undefined> => db.profile.get("me");

export async function update(patch: Partial<Omit<Profile, "id" | "updatedAt">>): Promise<void> {
  const existing = (await db.profile.get("me")) ?? {
    id: "me" as const,
    sex: "other" as const,
    updatedAt: Date.now(),
  };
  await db.profile.put({ ...existing, ...patch, id: "me", updatedAt: Date.now() });
}
