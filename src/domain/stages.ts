import { FEE_ONLY_TYPES, type DealType, type Stage } from "./options";

/** The main pipeline, in order. Track, Dead and Lost sit beside it. */
export const PIPELINE: Stage[] = ["BOV 1", "BOV 2", "Engaged", "Marketing", "Awarded", "Under Contract", "Closed"];
export const OFF_PIPELINE: Stage[] = ["Track", "Dead", "Lost"];
/** Counted in active pipeline totals. Track is reported separately, never blended in. */
export const ACTIVE_STAGES: Stage[] = ["BOV 1", "BOV 2", "Engaged", "Marketing", "Awarded", "Under Contract"];

/**
 * The further along BOV 1 → Closed of two stages; Track, Dead and Lost don't count.
 * A deal's furthest stage only ever moves forward on its own (corrections are by hand).
 */
export function furthestOf(a: Stage | null, b: Stage | null): Stage | null {
  const rank = (s: Stage | null) => (s ? PIPELINE.indexOf(s) : -1);
  const best = rank(a) >= rank(b) ? a : b;
  return best && PIPELINE.includes(best) ? best : null;
}

/**
 * Furthest stage is correctable while a deal is in play, and read-only once it's
 * parked in Track, Dead or Lost (Haili, 1.6) — except for the three admins.
 */
export function furthestStageLocked(stage: Stage, user: { isAdmin: boolean }) {
  return OFF_PIPELINE.includes(stage) && !user.isAdmin;
}

export const STAGE_HINTS: Record<Stage, string> = {
  "BOV 1": "Proposal in preparation",
  "BOV 2": "Proposal delivered",
  Engaged: "Packaging / OM in process",
  Marketing: "On the market",
  Awarded: "Buyer selected — DD and PSA",
  "Under Contract": "Closing period",
  Closed: "Closed",
  Track: "Dormant — seller elected to hold",
  Dead: "Had the deal — it fell apart or the seller pulled it",
  Lost: "Pitched and didn't win the listing",
};

export type DateField = "pitchDate" | "wonDate" | "launchDate" | "awardedDate" | "closeDate" | "followUpDate";

/**
 * Moving into these stages records the matching date (asked, defaulting to today —
 * except a Track follow-up, which is in the future and starts blank).
 */
export const STAGE_DATE: Partial<Record<Stage, { field: DateField; label: string; blank?: boolean }>> = {
  "BOV 2": { field: "pitchDate", label: "Pitch date" },
  Engaged: { field: "wonDate", label: "Won date" },
  Marketing: { field: "launchDate", label: "Launch date" },
  Awarded: { field: "awardedDate", label: "Awarded date" },
  Closed: { field: "closeDate", label: "Close date" },
  Track: { field: "followUpDate", label: "Follow-up date (optional)", blank: true },
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
  totalCommission: string | null;
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
 * guidance → contract → closed); Track, Dead and Lost use the latest price entered.
 * Other deal types use their headline figure (consulting and referral: the fee).
 * Totals straight across all types.
 */
export function dealValue(d: Prices): DealValue {
  if (d.dealType === "Equity") return headline(num(d.totalCapitalization), "Total capitalization");
  if (d.dealType === "Debt") return headline(num(d.loanAmount), "Loan amount");
  if (d.dealType === "Lease") return headline(num(d.totalLeaseConsideration), "Total lease consideration");
  if (d.dealType && FEE_ONLY_TYPES.includes(d.dealType)) return headline(num(d.totalCommission), "Fee");

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

  // Track / Dead / Lost: whatever was entered last along the way.
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

/** Deal dates the Pipeline report can show (stage-move dates plus the planning ones). */
export type KeyDateField = DateField | "pitchDueDate" | "callForOffersDate" | "ddExpirationDate";

/**
 * The date that matters for a deal at each stage, shown first on the Pipeline report
 * (Haili's mapping, 1.6). Under Contract's close date is the scheduled close.
 */
export const PIPELINE_KEY_DATE: Partial<Record<Stage, { field: KeyDateField; label: string }>> = {
  "BOV 1": { field: "pitchDueDate", label: "Pitch due date" },
  "BOV 2": { field: "pitchDate", label: "Pitch date" },
  Engaged: { field: "launchDate", label: "Launch date" },
  Marketing: { field: "callForOffersDate", label: "Call for offers" },
  Awarded: { field: "ddExpirationDate", label: "DD expiration" },
  "Under Contract": { field: "closeDate", label: "Close date" },
  Track: { field: "followUpDate", label: "Follow-up date" },
};

/** The fee shows from Engaged on — before the listing is won there's no fee to speak of. */
export const FEE_STAGES: Stage[] = ["Engaged", "Marketing", "Awarded", "Under Contract", "Closed"];
/** The buyer side shows once a buyer has been selected. */
export const BUYER_STAGES: Stage[] = ["Awarded", "Under Contract", "Closed"];
