import type { Cell, Column, Row } from "./data-grid";

/** What a column holds underneath its display text — decides its filter and its Excel format. */
export type ValueType = "text" | "number" | "money" | "date";

/**
 * A column filter. "values" keeps rows whose cell is one of the ticked values
 * (Excel's checklist); "range" is a min–max on the number; "dates" a from–to.
 */
export type Filter =
  | { kind: "values"; values: string[] }
  | { kind: "range"; min: number | null; max: number | null }
  | { kind: "dates"; from: string | null; to: string | null };

export const BLANK = "(Blank)";

export function valueType(c: Column): ValueType {
  return c.type ?? (c.kind === "number" ? "number" : "text");
}

/** The field a column sorts, filters and exports on. */
export function valueKey(c: Column) {
  return c.sortKey ?? c.key;
}

export function displayText(v: Cell, kind: Column["kind"]) {
  if (v === null || v === "" || v === false) return "";
  if (kind === "number" && typeof v === "number") return v.toLocaleString("en-US");
  return String(v);
}

/** The values a cell offers to the checklist: one per list item for `multi` columns, "(Blank)" when empty. */
export function cellValues(r: Row, c: Column): string[] {
  const text = displayText(r[c.key], c.kind);
  if (!text) return [BLANK];
  return c.multi ? text.split(LIST_SEPARATOR).filter(Boolean) : [text];
}

// List items are joined with ", " — but not the comma inside a name like "Lee Belland, III".
const LIST_SEPARATOR = /, (?!(?:Jr|Sr|II|III|IV|V)\b)/;

/** "2026-06-01" or "2026-06-01 14:05:00" → "2026-06-01"; anything else → null. */
export function isoDay(v: Cell): string | null {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
}

export function matches(r: Row, c: Column, f: Filter): boolean {
  if (f.kind === "values") {
    const keep = new Set(f.values);
    return cellValues(r, c).some((v) => keep.has(v));
  }
  if (f.kind === "range") {
    const v = r[valueKey(c)];
    if (typeof v !== "number") return false;
    return (f.min === null || v >= f.min) && (f.max === null || v <= f.max);
  }
  const day = isoDay(r[valueKey(c)]);
  if (!day) return false;
  return (f.from === null || day >= f.from) && (f.to === null || day <= f.to);
}

/** Rows passing every filter, optionally leaving one column's filter out (for that column's checklist). */
export function applyFilters(rows: Row[], columns: Column[], filters: Record<string, Filter>, except?: string) {
  const active = columns.filter((c) => filters[c.key] && c.key !== except);
  if (!active.length) return rows;
  return rows.filter((r) => active.every((c) => matches(r, c, filters[c.key])));
}

/** Reads what people type into a min/max box: "$1.5M", "250k", "1,000,000". Blank or nonsense → null. */
export function parseAmount(s: string): number | null {
  const t = s.trim().toLowerCase().replace(/[$,\s]/g, "");
  const m = t.match(/^(-?\d*\.?\d+)([km]?)$/);
  if (!m) return null;
  return Number(m[1]) * (m[2] === "m" ? 1_000_000 : m[2] === "k" ? 1_000 : 1);
}

function fmtAmount(n: number, t: ValueType) {
  return (t === "money" ? "$" : "") + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** "2026-06-01" → "6/1/2026" */
export function shortDay(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
}

/** Text for a filter chip, e.g. "Stage: Marketing, Awarded" or "Value: $1,000,000 – $5,000,000". */
export function describe(c: Column, f: Filter) {
  let what: string;
  if (f.kind === "values") {
    what = f.values.length > 3 ? `${f.values.slice(0, 3).join(", ")} +${f.values.length - 3} more` : f.values.join(", ") || "(none)";
  } else {
    const [a, b] =
      f.kind === "range"
        ? [f.min === null ? null : fmtAmount(f.min, valueType(c)), f.max === null ? null : fmtAmount(f.max, valueType(c))]
        : [f.from && shortDay(f.from), f.to && shortDay(f.to)];
    what = a && b ? `${a} – ${b}` : a ? `${f.kind === "dates" ? "from" : "at least"} ${a}` : `${f.kind === "dates" ? "to" : "at most"} ${b}`;
  }
  return `${c.label}: ${what}`;
}

/** Calendar-quarter shortcuts for date filters (reporting runs on calendar quarters). */
export function quarterRange(offset: number, today = new Date()) {
  const q = Math.floor(today.getMonth() / 3) + offset;
  const year = today.getFullYear() + Math.floor(q / 4);
  const startMonth = (((q % 4) + 4) % 4) * 3;
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(year, startMonth + 3, 0).getDate();
  return { from: `${year}-${pad(startMonth + 1)}-01`, to: `${year}-${pad(startMonth + 3)}-${pad(lastDay)}` };
}

export function yearRange(offset: number, today = new Date()) {
  const y = today.getFullYear() + offset;
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}
