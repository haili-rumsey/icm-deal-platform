import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { listLayouts } from "@/db/schema";
import { getCurrentUser } from "@/auth";

/** The signed-in person's chosen columns for this list, or null for the list's defaults. */
export async function myListLayout(listKey: string): Promise<string[] | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const [row] = await db
    .select({ columns: listLayouts.columns })
    .from(listLayouts)
    .where(and(eq(listLayouts.userId, user.id), eq(listLayouts.listKey, listKey)));
  return row?.columns ?? null;
}

/** Saves a layout; null goes back to the defaults. */
export async function saveListLayout(userId: string, listKey: string, columns: string[] | null) {
  if (!columns) {
    await db.delete(listLayouts).where(and(eq(listLayouts.userId, userId), eq(listLayouts.listKey, listKey)));
    return;
  }
  await db
    .insert(listLayouts)
    .values({ userId, listKey, columns })
    .onConflictDoUpdate({ target: [listLayouts.userId, listLayouts.listKey], set: { columns, updatedAt: new Date() } });
}
