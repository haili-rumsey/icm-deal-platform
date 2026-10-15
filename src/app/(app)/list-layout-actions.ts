"use server";

import { requireUser } from "@/auth";
import { saveListLayout } from "@/server/list-layouts";

/**
 * Remembers this person's columns and/or column widths on a list. A null part resets
 * it (default columns, fitted widths); a part left out is unchanged.
 */
export async function saveListLayoutAction(
  listKey: string,
  patch: { columns?: string[] | null; widths?: Record<string, number> | null },
) {
  const user = await requireUser();
  const columns =
    patch.columns === undefined ? undefined : (patch.columns?.filter((c) => typeof c === "string" && c.length < 64).slice(0, 60) ?? null);
  const widths =
    patch.widths === undefined
      ? undefined
      : patch.widths === null
        ? null
        : Object.fromEntries(
            Object.entries(patch.widths)
              .filter(([k, v]) => typeof k === "string" && k.length < 64 && typeof v === "number" && v >= 40 && v <= 1200)
              .slice(0, 60)
              .map(([k, v]) => [k, Math.round(v)]),
          );
  await saveListLayout(user.id, listKey.slice(0, 64), { columns, widths });
}
