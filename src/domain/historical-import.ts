/**
 * Historical import (milestone 1.5): turns rows of accounting's closed-deal export
 * ("Deal Activity") into deals ready to load. Pure functions only — reading the
 * spreadsheet and writing to the database live elsewhere, so a future admin upload
 * screen can reuse this as is.
 *
 * Mapping (PRD §7): Deal Id → REApps ID, Seller/Landlord → side A, Buyer/Tenant →
 * side B, Brokers → deal team (no lead flag), SF / Acres → property, Consideration →
 * the deal type's headline figure. Referral Type, Business Line, Division-as-desk
 * and Deal % are deliberately not imported. Every imported deal lands at Closed.
 */
import { CATEGORIES, REPRESENTED, type DealType, type Side } from "./options";

/** One spreadsheet row, keyed by normalized header (see `headerKey`). */
export type SourceRow = Record<string, string | number | Date | null>;

export type ImportProperty = {
  name?: string | null;
  address: string;
  city: string;
  state: string;
  buildingDesignation?: string | null;
  buildingSf?: number | null;
  acreage?: number | null;
};

export type ImportParty = {
  side: Side;
  /** Name as written in the export (often the holding LLC). */
  sourceName: string;
  /** The company it's recorded under — the institutional owner. */
  company: string;
  /** A person at that company, e.g. an individual under Private Investors. */
  contact?: string | null;
  /** Kept on the company when it's created (e.g. "Formerly Ares Management"). */
  companyNote?: string | null;
};

export type ImportBroker = { firstName: string; lastName: string; former: boolean };

export type ImportDeal = {
  reappsId: string;
  dealName: string;
  closeDate: string | null;
  dealType: DealType | null;
  /** Accounting's own label, e.g. "Equity Raise Fee". */
  sourceType: string;
  represented: (typeof REPRESENTED)[number] | null;
  category: (typeof CATEGORIES)[number] | null;
  isIos: boolean;
  closedPrice: string | null;
  totalCapitalization: string | null;
  loanAmount: string | null;
  totalLeaseConsideration: string | null;
  totalCommission: string | null;
  outsideCommission: string | null;
  inHouseGross: string | null;
  inHouseGrossManual: boolean;
  closingNotes: string;
  parties: ImportParty[];
  brokers: ImportBroker[];
  properties: ImportProperty[];
  /** Things worth a human look; never a reason to reject the row. */
  warnings: string[];
};

/** Answers from the review sheet, applied on top of the raw export. */
export type ReviewedAnswers = {
  companies: Record<string, { company: string; contact?: string | null; note?: string | null }>;
  /** Replaces the export's address for these Deal IDs (split portfolios, fixes). Empty = no property. */
  properties: Record<string, ImportProperty[]>;
  represented?: Record<string, string>;
  /** Existing app companies to rename to their official name, e.g. Brookfield → Brookfield Properties. */
  renameExisting?: Record<string, string>;
};

/** "Referral Type\n" → "referral type" */
export function headerKey(h: string) {
  return h.replace(/\s+/g, " ").trim().toLowerCase();
}

const TYPE_MAP: Record<string, DealType> = {
  sale: "Sale",
  lease: "Lease",
  "equity raise fee": "Equity",
  "debt placement fee": "Debt",
  "consulting fee": "Consulting",
  "referral fee": "Referral",
};

const PLACEHOLDER_BROKERS = new Set(["stream icm broker"]);

function text(v: SourceRow[string]): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).replace(/\s+/g, " ").trim();
  return s.toLowerCase() === "none" ? "" : s;
}

function amount(v: SourceRow[string]): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

const money = (n: number | null) => (n === null ? null : n.toFixed(2));

/** Excel stores dates as days since 1899-12-30; the reader may hand back either form. */
export function excelDate(v: SourceRow[string]): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const n = amount(v);
  if (n === null || n < 1) return null;
  return new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10);
}

/** Truthy marks in an added "IOS" column: x, yes, y, true, 1, ✓. */
export function isTruthyMark(v: SourceRow[string]) {
  const s = text(v).toLowerCase();
  return s !== "" && !["no", "n", "false", "0", "-"].includes(s);
}

/**
 * "Haili Rumsey, Lee Belland, III, Adam Green (former employee)" → three brokers.
 * A suffix after a comma (III, Jr.) belongs to the name before it.
 */
export function parseBrokers(cell: string): ImportBroker[] {
  const parts: string[] = [];
  for (const raw of cell.split(",")) {
    const p = raw.trim();
    if (!p) continue;
    if (/^(ii|iii|iv|jr\.?|sr\.?)$/i.test(p) && parts.length) parts[parts.length - 1] += `, ${p}`;
    else parts.push(p);
  }
  return parts
    .map((p) => {
      const former = /\(former employee\)/i.test(p);
      const name = p.replace(/\(former employee\)/i, "").trim();
      return { name, former };
    })
    .filter(({ name }) => name && !PLACEHOLDER_BROKERS.has(name.toLowerCase()))
    .map(({ name, former }) => {
      const [first, ...rest] = name.split(/\s+/);
      return { firstName: first, lastName: rest.join(" "), former };
    });
}

/** Matching key for a person's name: "Lee Belland, III" and "lee belland iii" match. */
export function personKey(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

/** "2202 Manana Dr., Ste 236" → address + building designation "Ste 236". */
export function splitSuite(address: string): { address: string; buildingDesignation: string | null } {
  const m = address.match(/^(.*?),\s*((?:ste|suite|unit|bldg|building)\b.*)$/i);
  return m ? { address: m[1].trim(), buildingDesignation: m[2].trim() } : { address, buildingDesignation: null };
}

/** Fallback when a name wasn't on the review sheet: drop the legal ending, keep the rest. */
export function cleanCompanyName(name: string) {
  let s = name.replace(/\s+/g, " ").trim();
  for (let i = 0; i < 2; i++) s = s.replace(/[,\s]+(L\.?L\.?C\.?|Inc\.?|L\.?P\.?|LTD\.?|LC|Corp\.?)$/i, "").trim();
  return s.replace(/[,\s]+$/, "");
}

/** Turns one export row into a deal. Never throws for bad data — it warns instead. */
export function toImportDeal(row: SourceRow, answers: ReviewedAnswers): ImportDeal {
  const get = (h: string) => row[headerKey(h)] ?? null;
  const reappsId = text(get("Deal Id"));
  const warnings: string[] = [];
  const sourceType = text(get("Deal Type"));
  const dealType = TYPE_MAP[sourceType.toLowerCase()] ?? null;
  if (!dealType) warnings.push(`Unknown deal type "${sourceType}" — imported without a type.`);

  const representedRaw = answers.represented?.[reappsId] ?? text(get("Represented"));
  const represented = (REPRESENTED as readonly string[]).includes(representedRaw)
    ? (representedRaw as ImportDeal["represented"])
    : null;
  if (!represented) warnings.push(`Side represented "${representedRaw}" isn't on the list — left blank.`);

  const division = text(get("Division"));
  const category = (CATEGORIES as readonly string[]).includes(division) ? (division as ImportDeal["category"]) : null;

  const consideration = amount(get("Consideration"));
  const total = amount(get("Total Commission"));
  const outside = amount(get("Outside Comm."));
  const inHouse = amount(get("In-House Gross"));
  const calculated = total === null ? null : total - (outside ?? 0);
  const value = { closedPrice: null, totalCapitalization: null, loanAmount: null, totalLeaseConsideration: null } as Pick<
    ImportDeal,
    "closedPrice" | "totalCapitalization" | "loanAmount" | "totalLeaseConsideration"
  >;
  if (dealType === "Lease") value.totalLeaseConsideration = money(consideration);
  else if (dealType === "Equity") value.totalCapitalization = money(consideration);
  else if (dealType === "Debt") value.loanAmount = money(consideration);
  else if (dealType === "Consulting") {
    // Consulting is valued by its fee; the export repeats the fee as consideration.
    if (consideration !== null && consideration !== total) warnings.push("Consulting consideration differs from the fee — not imported.");
  } else value.closedPrice = money(consideration); // Sale, and a referral's referred sale price
  if (dealType === "Sale" && consideration !== null && consideration === total) {
    warnings.push("Sale price equals the commission — check the sale price.");
  }

  const parties: ImportParty[] = [];
  for (const [side, header] of [
    ["A", "Seller/Landlord"],
    ["B", "Buyer/Tenant"],
  ] as const) {
    const sourceName = text(get(header));
    if (!sourceName) continue;
    const answer = answers.companies[sourceName];
    if (!answer) warnings.push(`"${sourceName}" wasn't on the review sheet — recorded as "${cleanCompanyName(sourceName)}".`);
    parties.push({
      side,
      sourceName,
      company: answer?.company ?? cleanCompanyName(sourceName),
      contact: answer?.contact ?? null,
      companyNote: answer?.note ?? null,
    });
  }

  let properties: ImportProperty[];
  if (reappsId in answers.properties) {
    properties = answers.properties[reappsId];
  } else {
    const raw = text(get("Property Address"));
    const sf = amount(get("SF"));
    const acres = amount(get("Acres"));
    properties = raw
      ? [
          {
            ...splitSuite(raw),
            city: text(get("City")),
            state: text(get("State")),
            buildingSf: sf ? Math.round(sf) : null,
            acreage: acres || null,
          },
        ]
      : [];
    if (!raw) warnings.push("No address — imported without a property.");
  }

  const mapped = dealType && sourceType.toLowerCase() !== dealType.toLowerCase();
  // Accounting's office code ("SNS - ", "SICM - ") is dropped; the original name goes in the notes.
  // Other-office references at the end, e.g. "(SDFW 55725)", stay in the name.
  const sourceName = text(get("Deal Name"));
  const dealName = sourceName.replace(/^(SNS|SICM) - /, "").trim();
  return {
    reappsId,
    dealName: dealName || `Deal ${reappsId}`,
    closeDate: excelDate(get("Closed Date")),
    dealType,
    sourceType,
    represented,
    category,
    isIos: isTruthyMark(get("IOS")) || isTruthyMark(get("IOS Deal")),
    ...value,
    totalCommission: money(total),
    outsideCommission: money(outside),
    inHouseGross: money(inHouse ?? calculated),
    // Accounting's figure is kept; it only counts as "typed over" when it differs from total − outside.
    inHouseGrossManual: inHouse !== null && calculated !== null && Math.abs(inHouse - calculated) > 0.005,
    closingNotes: `Imported from accounting's Deal Activity export.${mapped ? ` Accounting deal type: ${sourceType}.` : ""}${
      dealName !== sourceName ? ` Accounting deal name: ${sourceName}.` : ""
    }`,
    parties,
    brokers: parseBrokers(text(get("Brokers"))),
    properties,
    warnings,
  };
}
