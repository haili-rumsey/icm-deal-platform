/**
 * The Opportunity report (PRD §6): closed deals in a period, summed by deal type
 * (subtypes underneath) or by opportunity type. Reporting runs on calendar quarters.
 * IOS-desk deals — sales and leases together — are one row after the core ICM
 * groups, never mixed into them (Haili, 1.6). Pure — the page loads deals, this shapes them.
 */

export type Period = { key: string; label: string; from: string; to: string };

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, month: number) => new Date(y, month, 0).getDate(); // month 1–12

export function quarterPeriod(year: number, q: number): Period {
  const m = (q - 1) * 3;
  return { key: `${year}-Q${q}`, label: `Q${q} ${year}`, from: `${year}-${pad(m + 1)}-01`, to: `${year}-${pad(m + 3)}-${pad(lastDay(year, m + 3))}` };
}

export function yearPeriod(year: number): Period {
  return { key: String(year), label: String(year), from: `${year}-01-01`, to: `${year}-12-31` };
}

/** "2026-Q3", "2026", or a custom "2026-01-15_2026-03-31" → its period; null if it doesn't parse. */
export function parsePeriod(key: string | undefined): Period | null {
  if (!key) return null;
  let m = key.match(/^(\d{4})-Q([1-4])$/);
  if (m) return quarterPeriod(Number(m[1]), Number(m[2]));
  m = key.match(/^(\d{4})$/);
  if (m) return yearPeriod(Number(m[1]));
  m = key.match(/^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/);
  if (m && m[1] <= m[2]) {
    const [, from, to] = m;
    const fmt = (iso: string) => {
      const [y, mo, d] = iso.split("-");
      return `${Number(mo)}/${Number(d)}/${y}`;
    };
    return { key, label: `${fmt(from)} – ${fmt(to)}`, from, to };
  }
  return null;
}

/** Every quarter and year from the earliest close date to today, newest first, for the picker. */
export function periodChoices(earliest: string | null, today: Date) {
  const nowY = today.getFullYear();
  const nowQ = Math.floor(today.getMonth() / 3) + 1;
  const firstY = earliest ? Number(earliest.slice(0, 4)) : nowY;
  const quarters: Period[] = [];
  for (let y = nowY; y >= firstY; y--) for (let q = y === nowY ? nowQ : 4; q >= 1; q--) quarters.push(quarterPeriod(y, q));
  const years: Period[] = [];
  for (let y = nowY; y >= firstY; y--) years.push(yearPeriod(y));
  return { current: quarterPeriod(nowY, nowQ), quarters, years };
}

export type ReportDeal = {
  id: string;
  isIos: boolean;
  dealType: string | null;
  dealSubtype: string | null;
  opportunityType: string | null;
  closeDate: string | null;
  value: number | null;
  fee: number | null;
  sf: number | null;
  acres: number | null;
};

export type GroupBy = "type" | "opportunity";

export type SummaryRow = {
  /** Stable id for selection, e.g. "Sale" or "Sale/Investment Sale". */
  id: string;
  label: string;
  level: 0 | 1;
  dealIds: string[];
  count: number;
  value: number | null;
  fee: number | null;
  sf: number | null;
  acres: number | null;
  children: SummaryRow[];
};

export const NOT_SET = "Not set";

function sum(deals: ReportDeal[], k: "value" | "fee" | "sf" | "acres") {
  let t: number | null = null;
  for (const d of deals) if (d[k] !== null) t = (t ?? 0) + (d[k] as number);
  return t;
}

function row(id: string, label: string, level: 0 | 1, deals: ReportDeal[], children: SummaryRow[] = []): SummaryRow {
  return {
    id,
    label,
    level,
    dealIds: deals.map((d) => d.id),
    count: deals.length,
    value: sum(deals, "value"),
    fee: sum(deals, "fee"),
    sf: sum(deals, "sf"),
    acres: sum(deals, "acres"),
    children,
  };
}

/**
 * Groups in a fixed order (the controlled list's order) with every listed value
 * shown even at zero, so a quiet period still reads Sale, Equity, Debt…; "Not set"
 * (and anything off the list) only when present, last.
 */
function groupIn<K extends string>(deals: ReportDeal[], key: (d: ReportDeal) => string | null, order: readonly K[], keepEmpty = true) {
  const byKey = new Map<string, ReportDeal[]>(keepEmpty ? order.map((k) => [k, []]) : []);
  for (const d of deals) {
    const k = key(d) ?? NOT_SET;
    byKey.set(k, [...(byKey.get(k) ?? []), d]);
  }
  const rank = (k: string) => (k === NOT_SET ? Infinity : order.indexOf(k as K) === -1 ? order.length : order.indexOf(k as K));
  return [...byKey].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}

export function summarize(
  deals: ReportDeal[],
  by: GroupBy,
  lists: { dealTypes: readonly string[]; subtypes: readonly string[]; opportunityTypes: readonly string[] },
): { rows: SummaryRow[]; core: SummaryRow; ios: SummaryRow; total: SummaryRow } {
  const coreDeals = deals.filter((d) => !d.isIos);
  const rows =
    by === "type"
      ? groupIn(coreDeals, (d) => d.dealType, lists.dealTypes).map(([type, ds]) => {
          // Subtypes only where the type has any recorded; one "Not set" child alone isn't worth showing.
          const subs = groupIn(ds, (d) => d.dealSubtype, lists.subtypes, false);
          const children = subs.length === 1 && subs[0][0] === NOT_SET ? [] : subs.map(([s, sd]) => row(`${type}/${s}`, s, 1, sd));
          return row(type, type, 0, ds, children);
        })
      : groupIn(coreDeals, (d) => d.opportunityType, lists.opportunityTypes).map(([t, ds]) => row(t, t, 0, ds));
  return {
    rows,
    core: row("core", "ICM total", 0, coreDeals),
    ios: row("ios", "IOS Deals", 0, deals.filter((d) => d.isIos)),
    total: row("total", "Total", 0, deals),
  };
}
