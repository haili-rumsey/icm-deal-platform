import type { Column, Row } from "./data-grid";
import { valueKey, valueType } from "./data-grid-filters";

/**
 * Rows grouped into fixed sections (e.g. pipeline stages), each with a subtotal
 * row, and a grand total across the sections that count. A section marked
 * `apart` (Track) comes after the grand total and is never added into it.
 */
export type Grouping = {
  /** Row field holding the section id. */
  by: string;
  sections: { id: string; title: string; note?: string; apart?: boolean }[];
  /** Label on the grand-total row, e.g. "Active pipeline". */
  totalLabel: string;
  /** What a row is, for counts: "deal" → "3 deals". */
  unit: string;
};

export type Totals = { count: number; sums: Record<string, number | null> };

export type Block =
  | { kind: "section"; id: string; title: string; note?: string; rows: Row[]; totals: Totals }
  | { kind: "total"; title: string; totals: Totals };

function totalsOf(rows: Row[], columns: Column[]): Totals {
  const sums: Record<string, number | null> = {};
  for (const c of columns.filter((c) => c.total)) {
    let sum: number | null = null;
    for (const r of rows) {
      const v = r[valueKey(c)];
      if (typeof v === "number") sum = (sum ?? 0) + v;
    }
    sums[c.key] = sum;
  }
  return { count: rows.length, sums };
}

/**
 * Splits already-sorted rows into their sections, in section order. Empty
 * sections are kept when `keepEmpty` (the full walk of every stage) and dropped
 * while filters or a search are narrowing the list.
 */
export function buildBlocks(rows: Row[], columns: Column[], g: Grouping, keepEmpty: boolean): Block[] {
  const byId = new Map<string, Row[]>(g.sections.map((s) => [s.id, []]));
  for (const r of rows) byId.get(String(r[g.by]))?.push(r);
  const section = (s: Grouping["sections"][number]): Block => {
    const rs = byId.get(s.id) ?? [];
    return { kind: "section", id: s.id, title: s.title, note: s.note, rows: rs, totals: totalsOf(rs, columns) };
  };
  const keep = (b: Block) => keepEmpty || (b.kind === "section" && b.rows.length > 0);
  const counted = g.sections.filter((s) => !s.apart);
  const blocks = counted.map(section).filter(keep);
  const countedRows = counted.flatMap((s) => byId.get(s.id) ?? []);
  blocks.push({ kind: "total", title: g.totalLabel, totals: totalsOf(countedRows, columns) });
  blocks.push(...g.sections.filter((s) => s.apart).map(section).filter(keep));
  return blocks;
}

/** A subtotal for the screen: money in millions once it's big, otherwise whole numbers. */
export function formatTotal(c: Column, v: number | null) {
  if (v === null) return "";
  if (valueType(c) === "money") {
    return Math.abs(v) >= 1_000_000
      ? `$${(v / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}M`
      : `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export const countLabel = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
