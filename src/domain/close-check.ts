import { FEE_ONLY_TYPES, partyLabel, SUBTYPES_BY_TYPE, type DealType } from "./options";

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
  outsideCommission: string | null;
  inHouseGross: string | null;
  properties: { address: string | null; buildingSf: number | null; acreage: string | null }[];
  sideBCount: number;
  teamCount: number;
};

const blank = (v: string | null | undefined) => v === null || v === undefined || v.trim() === "";

export function closeBlockers(d: CloseCheckInput): string[] {
  const missing: string[] = [];
  if (blank(d.reappsId)) missing.push("REApps ID");
  if (!d.dealType) missing.push("deal type");
  // Only types that have subtypes need one (not leases, consulting or referrals).
  if ((!d.dealType || SUBTYPES_BY_TYPE[d.dealType].length > 0) && blank(d.dealSubtype)) missing.push("subtype");
  if (blank(d.opportunityType)) missing.push("opportunity type");
  if (blank(d.represented)) missing.push("side represented");
  if (blank(d.closeDate)) missing.push("close date");

  // Consulting and referral deals are valued by the fee — total commission, checked below.
  if (!d.dealType || !FEE_ONLY_TYPES.includes(d.dealType)) {
    const value =
      d.dealType === "Equity"
        ? [d.totalCapitalization, "total capitalization"]
        : d.dealType === "Debt"
          ? [d.loanAmount, "loan amount"]
          : d.dealType === "Lease"
            ? [d.totalLeaseConsideration, "total lease consideration"]
            : [d.closedPrice, "sale price"];
    if (blank(value[0])) missing.push(value[1] as string);
  }

  if (blank(d.totalCommission)) missing.push("total commission");
  // Outside commission is required to close, but 0 is a fine answer (Haili, 1.6).
  if (blank(d.outsideCommission)) missing.push("outside commission (0 if none)");
  else if (!blank(d.totalCommission) && !feeSplitAddsUp(d.totalCommission!, d.outsideCommission!, d.inHouseGross))
    missing.push("in-house gross + outside commission to equal total commission");
  // A consulting fee may not be tied to a property.
  const needsProperty = d.dealType !== "Consulting";
  if (d.properties.length === 0) {
    if (needsProperty) missing.push("a property (address)");
  } else if (d.properties.some((p) => blank(p.address))) missing.push("an address on every property");
  // Total SF or total acreage across the deal's properties (IOS yards often have acreage only).
  const totalSf = d.properties.reduce((s, p) => s + (p.buildingSf ?? 0), 0);
  const totalAcres = d.properties.reduce((s, p) => s + Number(p.acreage ?? 0), 0);
  if (d.properties.length > 0 && totalSf <= 0 && totalAcres <= 0) missing.push("total SF or acreage");
  if (d.sideBCount === 0) missing.push(d.dealType ? `a ${partyLabel(d.dealType, "B").toLowerCase()} party` : "a side B party");
  if (d.teamCount === 0) missing.push("the deal team");
  return missing;
}

/** In-house gross + outside commission = total commission (to the cent). A blank in-house is calculated, so it adds up. */
export function feeSplitAddsUp(total: string, outside: string, inHouse: string | null) {
  if (blank(inHouse)) return true;
  return Math.abs(Number(inHouse) + Number(outside) - Number(total)) < 0.005;
}

/** Close requirements that need the deal's own tabs, not the close pop-up. */
export function needsDealTabs(item: string) {
  return item.startsWith("a property") || item.startsWith("an address") || item.startsWith("total SF") || item === "the deal team";
}

export function closeBlockedMessage(missing: string[]) {
  return `This deal can't move to Closed yet. Still needed: ${missing.join(", ")}.`;
}
