import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/** Display name for a last-modified-by stamp. */
export async function userName(id: string | null): Promise<string | null> {
  if (!id) return null;
  const [u] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, id));
  return u ? (u.name ?? u.email) : null;
}
