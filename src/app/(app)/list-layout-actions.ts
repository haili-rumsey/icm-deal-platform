"use server";

import { requireUser } from "@/auth";
import { saveListLayout } from "@/server/list-layouts";

/** Remembers which columns this person wants on a list. null resets to the defaults. */
export async function saveListLayoutAction(listKey: string, columns: string[] | null) {
  const user = await requireUser();
  const clean = columns?.filter((c) => typeof c === "string" && c.length < 64).slice(0, 60) ?? null;
  await saveListLayout(user.id, listKey.slice(0, 64), clean);
}
