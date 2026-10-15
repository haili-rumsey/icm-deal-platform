import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { listLayouts } from "@/db/schema";
import { getCurrentUser } from "@/auth";

/** A person's saved layout for one list: chosen columns (empty = defaults) and dragged widths. */
export type ListLayout = { columns: string[]; widths: Record<string, number> };

/** The signed-in person's layout for this list, or null for the list's defaults. */
export async function myListLayout(listKey: string): Promise<ListLayout | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const [row] = await db
    .select({ columns: listLayouts.columns, widths: listLayouts.widths })
    .from(listLayouts)
    .where(and(eq(listLayouts.userId, user.id), eq(listLayouts.listKey, listKey)));
  return row ? { columns: row.columns, widths: row.widths ?? {} } : null;
}

/** Saves part of a layout. `columns: null` goes back to the default columns; `widths: null` to fitted widths. */
export async function saveListLayout(
  userId: string,
  listKey: string,
  patch: { columns?: string[] | null; widths?: Record<string, number> | null },
) {
  const set: Partial<typeof listLayouts.$inferInsert> = { updatedAt: new Date() };
  if (patch.columns !== undefined) set.columns = patch.columns ?? [];
  if (patch.widths !== undefined) set.widths = patch.widths;
  await db
    .insert(listLayouts)
    .values({ userId, listKey, columns: patch.columns ?? [], widths: patch.widths ?? null })
    .onConflictDoUpdate({ target: [listLayouts.userId, listLayouts.listKey], set });
}
