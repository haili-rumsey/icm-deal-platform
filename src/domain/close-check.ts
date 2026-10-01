import type { DealType } from "./options";
import { partyLabel } from "./options";

/**
 * Minimum information to move a deal into Closed (PRD Rev. 4.2 — the one stage
 * move that is blocked). Applies only on the move into Closed; an admin editing an
 * already-closed deal (e.g. an imported one) isn't held to it.
 */
export type CloseCheckInput = {
  dealType: DealType | null;
  dealSubtype: string | null;
  reappsId: string | null;
  opportunityType: string | null;
  represented: string | null;
  closeDate: string | null;
  closedPrice: string | null;
  totalCapitalization: string | null;
  loanAmount: string | null;
  totalLeaseConsideration: string | null;
  totalCommission: string | null;
  properties: { address: string | null; buildingSf: number | null; acreage: string | null }[];
  sideBCount: number;
  teamCount: number;
};

const blank = (v: string | null | undefined) => v === null || v === undefined || v.trim() === "";

export function closeBlockers(d: CloseCheckInput): string[] {
  const missing: string[] = [];
  if (blank(d.reappsId)) missing.push("REApps ID");
  if (!d.dealType) missing.push("deal type");
  if (d.dealType !== "Lease" && blank(d.dealSubtype)) missing.push("subtype");
  if (blank(d.opportunityType)) missing.push("opportunity type");
  if (blank(d.represented)) missing.push("side represented");
  if (blank(d.closeDate)) missing.push("close date");

  const value =
    d.dealType === "Equity"
      ? [d.totalCapitalization, "total capitalization"]
      : d.dealType === "Debt"
        ? [d.loanAmount, "loan amount"]
        : d.dealType === "Lease"
          ? [d.totalLeaseConsideration, "total lease consideration"]
          : [d.closedPrice, "sale price"];
  if (blank(value[0])) missing.push(value[1] as string);

  if (blank(d.totalCommission)) missing.push("total commission");
  if (d.properties.length === 0) missing.push("a property (address)");
  else if (d.properties.some((p) => blank(p.address))) missing.push("an address on every property");
  // Total SF or total acreage across the deal's properties (IOS yards often have acreage only).
  const totalSf = d.properties.reduce((s, p) => s + (p.buildingSf ?? 0), 0);
  const totalAcres = d.properties.reduce((s, p) => s + Number(p.acreage ?? 0), 0);
  if (d.properties.length > 0 && totalSf <= 0 && totalAcres <= 0) missing.push("total SF or acreage");
  if (d.sideBCount === 0) missing.push(d.dealType ? `a ${partyLabel(d.dealType, "B").toLowerCase()} party` : "a side B party");
  if (d.teamCount === 0) missing.push("the deal team");
  return missing;
}

export function closeBlockedMessage(missing: string[]) {
  return `This deal can't move to Closed yet. Still needed: ${missing.join(", ")}.`;
}
