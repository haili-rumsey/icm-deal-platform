"use server";

import { requireUser } from "@/auth";
import { search, type SearchResults } from "@/server/search";

/** Suggestions for the top-bar search box, a few of each kind. */
export async function suggestAction(query: string): Promise<SearchResults> {
  await requireUser();
  const r = await search(query.slice(0, 100), 4);
  return { ...r, deals: r.deals.slice(0, 4) };
}
