import type { DealType, Stage } from "./options";

/** The main pipeline, in order. Track and Dead/Lost sit beside it. */
export const PIPELINE: Stage[] = ["BOV 1", "BOV 2", "Engaged", "Marketing", "Awarded", "Under Contract", "Closed"];
export const OFF_PIPELINE: Stage[] = ["Track", "Dead/Lost"];
/** Counted in active pipeline totals. Track is reported separately, never blended in. */
export const ACTIVE_STAGES: Stage[] = ["BOV 1", "BOV 2", "Engaged", "Marketing", "Awarded", "Under Contract"];

export const STAGE_HINTS: Record<Stage, string> = {
  "BOV 1": "Proposal in preparation",
  "BOV 2": "Proposal delivered",
  Engaged: "Packaging / OM in process",
  Marketing: "On the market",
  Awarded: "Buyer selected — DD and PSA",
  "Under Contract": "Closing period",
  Closed: "Closed",
  Track: "Dormant — seller elected to hold",
  "Dead/Lost": "Dead or lost",
};

export type DateField = "pitchDate" | "wonDate" | "launchDate" | "awardedDate" | "closeDate";

/** Moving into these stages records the matching date (asked, defaulting to today). */
export const STAGE_DATE: Partial<Record<Stage, { field: DateField; label: string }>> = {
  "BOV 2": { field: "pitchDate", label: "Pitch date" },
  Engaged: { field: "wonDate", label: "Won date" },
  Marketing: { field: "launchDate", label: "Launch date" },
  Awarded: { field: "awardedDate", label: "Awarded date" },
  Closed: { field: "closeDate", label: "Close date" },
};

type Prices = {
  dealType: DealType | null;
  stage: Stage;
  bovPriceMid: string | null;
  guidancePrice: string | null;
  closedPrice: string | null;
  totalCapitalization: string | null;
  loanAmount: string | null;
  totalLeaseConsideration: string | null;
};

export type DealValue = {
  value: number | null;
  /** Which number it is, e.g. "Guidance" or "Loan amount". */
  source: string;
  /** Set when the number for this stage hasn't been entered yet. */
  missing?: string;
};

const num = (v: string | null) => (v === null || v === "" ? null : Number(v));

/**
 * The deal's current value. For a sale the price follows the stage (BOV mid →
 * guidance → contract → closed); Track and Dead/Lost use the latest price entered.
 * Other deal types use their headline figure. Totals straight across all types.
 */
export function dealValue(d: Prices): DealValue {
  if (d.dealType === "Equity") return headline(num(d.totalCapitalization), "Total capitalization");
  if (d.dealType === "Debt") return headline(num(d.loanAmount), "Loan amount");
  if (d.dealType === "Lease") return headline(num(d.totalLeaseConsideration), "Total lease consideration");

  const byStage: Partial<Record<Stage, [string | null, string]>> = {
    "BOV 1": [d.bovPriceMid, "BOV mid"],
    "BOV 2": [d.bovPriceMid, "BOV mid"],
    Engaged: [d.guidancePrice, "Guidance"],
    Marketing: [d.guidancePrice, "Guidance"],
    // One sale price from award through close; retrades go in price notes.
    Awarded: [d.closedPrice, "Sale price"],
    "Under Contract": [d.closedPrice, "Sale price"],
    Closed: [d.closedPrice, "Sale price"],
  };
  const forStage = byStage[d.stage];
  if (forStage) return headline(num(forStage[0]), forStage[1]);

  // Track / Dead-Lost: whatever was entered last along the way.
  const latest: [string | null, string][] = [
    [d.closedPrice, "Sale price"],
    [d.guidancePrice, "Guidance"],
    [d.bovPriceMid, "BOV mid"],
  ];
  const found = latest.find(([v]) => num(v) !== null);
  return found ? { value: num(found[0]), source: found[1] } : { value: null, source: "Price" };
}

function headline(value: number | null, source: string): DealValue {
  return value === null ? { value, source, missing: `${source.toLowerCase()} missing` } : { value, source };
}

export function pricePerSf(value: number | null, totalSf: number) {
  return value !== null && totalSf > 0 ? value / totalSf : null;
}

export function formatMoney(v: number | null, compact = false) {
  if (v === null) return null;
  if (compact && Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}M`;
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
