import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, verificationTokens } from "@/db/schema";
import { isStreamEmail, normalizeEmail } from "./rules";

export type UserRow = {
  id: string;
  name: string | null;
  email: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: Date;
};

export async function listUsers(): Promise<UserRow[]> {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isAdmin: users.isAdmin,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.name), asc(users.email));
}

export type AddUserResult = { ok: true } | { ok: false; message: string };

export async function addUser(name: string, email: string, byId: string): Promise<AddUserResult> {
  const address = normalizeEmail(email);
  const trimmedName = name.trim();
  if (!trimmedName) return { ok: false, message: "Enter a name." };
  if (!isStreamEmail(address)) return { ok: false, message: "Must be an @streamrealty.com address." };

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, address));
  if (existing) return { ok: false, message: "That person is already on the list." };

  await db.insert(users).values({
    name: trimmedName,
    email: address,
    createdById: byId,
    lastModifiedById: byId,
  });
  return { ok: true };
}

/**
 * Deactivating takes effect immediately: the user is marked inactive (no new links),
 * any unused sign-in links are deleted, and every active session is deleted, so an
 * open browser is signed out on its next click.
 */
export async function setUserActive(userId: string, active: boolean, byId: string) {
  if (userId === byId && !active) throw new Error("You can't deactivate yourself.");

  const [target] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  if (!target) throw new Error("User not found.");

  const update = db
    .update(users)
    .set({ isActive: active, lastModifiedAt: new Date(), lastModifiedById: byId })
    .where(eq(users.id, userId));

  if (active) {
    await update;
    return;
  }
  await db.batch([
    update,
    db.delete(verificationTokens).where(eq(verificationTokens.identifier, target.email)),
    db.delete(sessions).where(eq(sessions.userId, userId)),
  ]);
}
