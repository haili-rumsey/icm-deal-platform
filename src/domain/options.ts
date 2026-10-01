/**
 * Controlled lists from the PRD. The database enums are built from these, and the
 * UI reads labels from here, so a list is only ever defined once.
 */

export const CATEGORIES = ["Industrial", "Office", "Retail", "IOS", "Land", "Mixed"] as const;

export const DEAL_TYPES = ["Sale", "Equity", "Debt", "Lease"] as const;
export type DealType = (typeof DEAL_TYPES)[number];

export const DEAL_SUBTYPES = ["Investment Sale", "Forward Sale", "NNN", "Portfolio", "JV", "Senior Financing"] as const;
export const SUBTYPES_BY_TYPE: Record<DealType, readonly (typeof DEAL_SUBTYPES)[number][]> = {
  Sale: ["Investment Sale", "Forward Sale", "NNN", "Portfolio"],
  Equity: ["JV"],
  Debt: ["Senior Financing"],
  Lease: [],
};

export const OPPORTUNITY_TYPES = ["Core", "Core Plus", "Value Add", "Opportunistic", "Development"] as const;

export const REPRESENTED = ["Seller/Landlord", "Buyer/Tenant", "Both"] as const;

export const TENANCY = ["Single", "Multi"] as const;
export const BUILDING_CLASSES = ["A", "B", "C"] as const;
export const CONFIGURATIONS = ["Rear-load", "Front-load", "Cross-dock", "Shallow bay", "IOS"] as const;
export const SPRINKLER_TYPES = ["ESFR", "Wet", "Dry", "Dry with in-rack", "None"] as const;

export const COMPANY_TYPES = ["Investor", "Developer", "Owner-user", "Lender", "Brokerage"] as const;
// Investment strategy uses the same list as opportunity type.
export const INVESTMENT_STRATEGIES = OPPORTUNITY_TYPES;

/** Office of an ICM team member. */
export const LOCATIONS = ["Dallas", "Houston"] as const;

export const TEAM_ROLES = ["Producer", "Analyst", "Operations", "Designer", "Leasing"] as const;

export const SIDES = ["A", "B"] as const;
export type Side = (typeof SIDES)[number];

/** Same two sides on every deal; only the names change by deal type. */
export const PARTY_LABELS: Record<DealType, Record<Side, string>> = {
  Sale: { A: "Seller", B: "Buyer" },
  Equity: { A: "Sponsor", B: "Capital Partner" },
  Debt: { A: "Borrower", B: "Lender" },
  Lease: { A: "Landlord", B: "Tenant" },
};

export function partyLabel(dealType: DealType | null | undefined, side: Side): string {
  return dealType ? PARTY_LABELS[dealType][side] : `Side ${side}`;
}

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS",
  "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC",
  "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;

/** Companies the system relies on existing. Found by these websites. */
export const STREAM_WEBSITE = "streamrealty.com";
export const STREAM_COMPANY_NAME = "Stream Realty Partners";
export const PRIVATE_INVESTORS_NAME = "Private Investors";
