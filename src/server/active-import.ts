import "server-only";
import { and, eq, inArray, like } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { companies, contacts, dealParties, dealProperties, deals, dealTeam, properties, propertyOwners } from "@/db/schema";
import { personKey } from "@/domain/historical-import";
import { CONFIGURATIONS, type Stage } from "@/domain/options";
import { ACTIVE_STAGES } from "@/domain/stages";
import type { GeocodeMatch } from "./geocode";

/**
 * Active-deals import (1.6): loads the deals from Haili's pipeline tracker, already
 * resolved against her review sheet by Import/active-import-tools/prepare.cjs.
 * Runs inside one transaction (practice run = roll back). Safe to re-run: a deal
 * whose notes carry its tracker row marker is skipped. Companies, Stream people and
 * properties are matched before anything new is created.
 */
type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type ActiveImportProperty = {
  name: string | null;
  address: string | null;
  city: string;
  state: string;
  zip: string | null;
  buildingDesignation: string | null;
  buildingSf: number | null;
  acreage: number | null;
  clearHeightFt: number | null;
  configuration: string | null;
  /** The only location is a dropped map pin. */
  pin: { lat: number; lng: number } | null;
  /** Where the address came from, for Haili's check workbook. */
  source?: string;
  /** "building": typed for this building; "deal": the tracker's deal total on a one-building deal. */
  sizeFrom?: "building" | "deal" | null;
};

export type ActiveImportDeal = {
  sourceRow: number;
  dealName: string;
  stage: Stage;
  furthestStage: Stage | null;
  pitchStatus: "Won" | "Lost" | null;
  dates: Partial<Record<"pitchDueDate" | "pitchDate" | "launchDate" | "callForOffersDate" | "ddExpirationDate" | "closeDate", string>>;
  bovPriceMid?: string | null;
  guidancePrice?: string | null;
  closedPrice?: string | null;
  bovYear1Cap?: string | null;
  omYear1Cap?: string | null;
  closedYear1Cap?: string | null;
  totalCommission: string | null;
  /** Brokerage that won the listing (Lost). */
  lostTo: string | null;
  lostNote: string | null;
  deadNote: string | null;
  notes: string[];
  parties: { side: "A" | "B"; company: string; contact: string | null }[];
  team: { name: string; analyst?: boolean; lead?: boolean }[];
  properties: ActiveImportProperty[];
  warnings: string[];
};

/** Google's answer for a property (or for its pin), or null to keep it as typed. */
export type ActiveGeocoder = (p: ActiveImportProperty) => Promise<GeocodeMatch | null>;

export type PropertyCheck = {
  sourceRow: number;
  dealName: string;
  typed: string;
  saved: string;
  city: string;
  state: string;
  verified: boolean;
  fromPin: boolean;
  sf: number | null;
  acres: number | null;
  reused: boolean;
  source: string;
};

export type ActiveImportReport = {
  imported: { sourceRow: number; dealName: string; stage: Stage; properties: number }[];
  skippedExisting: number[];
  companiesCreated: string[];
  contactsCreated: string[];
  propertiesCreated: number;
  propertiesReused: number;
  ownersSet: number;
  unverified: string[];
  sizeConflicts: string[];
  propertyChecks: PropertyCheck[];
  warnings: { sourceRow: number; dealName: string; message: string }[];
};

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
export const trackerMarker = (row: number) => `Imported from ICM Deal Tracker 10.8, row ${row}.`;

function splitName(full: string) {
  const [first, ...rest] = full.trim().split(/\s+/);
  return { firstName: first, lastName: rest.join(" ") };
}

/** Active deals first, so an active seller becomes the owner of a shared property. */
const OWNER_ORDER: Stage[] = [...ACTIVE_STAGES, "Track", "Lost", "Dead"];

export async function importActiveDeals(
  db: Db,
  rows: ActiveImportDeal[],
  opts: { byId: string; geocode: ActiveGeocoder },
): Promise<ActiveImportReport> {
  const report: ActiveImportReport = {
    imported: [],
    skippedExisting: [],
    companiesCreated: [],
    contactsCreated: [],
    propertiesCreated: 0,
    propertiesReused: 0,
    ownersSet: 0,
    unverified: [],
    sizeConflicts: [],
    propertyChecks: [],
    warnings: [],
  };
  const by = { createdById: opts.byId, lastModifiedById: opts.byId };

  // ---- What's already in the system ----
  const companyByName = new Map<string, string>();
  let streamId = "";
  for (const c of await db.select({ id: companies.id, name: companies.name, key: companies.systemKey }).from(companies)) {
    if (!companyByName.has(norm(c.name)) || c.key) companyByName.set(norm(c.name), c.id);
    if (c.key === "stream") streamId = c.id;
  }
  if (!streamId) throw new Error("The Stream Realty Partners company is missing. Run the seed first.");
  const contactByKey = new Map<string, string>();
  const streamPeople = new Map<string, string>(); // full-name key → contact id
  for (const c of await db
    .select({ id: contacts.id, companyId: contacts.companyId, first: contacts.firstName, last: contacts.lastName })
    .from(contacts)) {
    contactByKey.set(`${c.companyId}|${personKey(c.first, c.last)}`, c.id);
    if (c.companyId === streamId) streamPeople.set(personKey(c.first, c.last), c.id);
  }
  /** `from`: where the size on record came from — the system already, or this run (building / deal figure). */
  type Known = { id: string; sf: number | null; acres: number | null; label: string; from: "system" | "building" | "deal" | null };
  const propertyByKey = new Map<string, Known>();
  const keyFor = (placeId: string | null, address: string, city: string, designation: string | null | undefined) =>
    placeId ? `place|${placeId}|${norm(designation)}` : `text|${norm(address)}|${norm(city)}|${norm(designation)}`;
  for (const p of await db.select().from(properties)) {
    propertyByKey.set(keyFor(p.googlePlaceId, p.address ?? "", p.city ?? "", p.buildingDesignation), {
      id: p.id,
      sf: p.buildingSf,
      acres: p.acreage === null ? null : Number(p.acreage),
      label: p.address ?? "(no address)",
      from: p.buildingSf !== null || p.acreage !== null ? "system" : null,
    });
  }

  async function companyId(name: string) {
    const found = companyByName.get(norm(name));
    if (found) return found;
    // No website yet: the company form asks for one (or "none") the next time it's saved.
    const [row] = await db
      .insert(companies)
      .values({ name, notes: "Added by the active-deals import (ICM Deal Tracker 10.8).", ...by })
      .returning({ id: companies.id });
    companyByName.set(norm(name), row.id);
    report.companiesCreated.push(name);
    return row.id;
  }

  async function contactId(company: string, full: string) {
    const { firstName, lastName } = splitName(full);
    const key = `${company}|${personKey(firstName, lastName)}`;
    const found = contactByKey.get(key);
    if (found) return found;
    const [row] = await db
      .insert(contacts)
      .values({ companyId: company, firstName, lastName, ...by })
      .returning({ id: contacts.id });
    contactByKey.set(key, row.id);
    report.contactsCreated.push(full);
    return row.id;
  }

  /** Sizes are per building (Haili, 1.6): a figure typed for the building wins over one already on
   *  record; a deal total never overwrites a building's size and is kept in the deal notes instead. */
  const dealNoteAdds = new Map<number, string[]>();
  async function propertyId(d: ActiveImportDeal, p: ActiveImportProperty) {
    const match = await opts.geocode(p);
    const typed = [p.address, p.buildingDesignation].filter(Boolean).join(", ") || (p.pin ? `Map pin ${p.pin.lat}, ${p.pin.lng}` : "");
    // A pin is never "verified": Google returns the nearest address, which may not be the site.
    const verified = !!match && !p.pin;
    // Google gives one street number; keep a range as written ("1700-1750 …") and use Google for the rest.
    const range = !!p.address && /^\d+\s*-\s*\d+/.test(p.address);
    const address = match && !range ? match.address : (p.address ?? "").replace(/^(\d+)\s*-\s*(\d+)/, "$1-$2");
    const city = match?.city || p.city;
    const state = match?.state || p.state;
    const key = keyFor(verified ? match!.placeId : null, address, city, p.buildingDesignation);
    const sf = p.buildingSf;
    const acres = p.acreage;
    const check: PropertyCheck = {
      sourceRow: d.sourceRow,
      dealName: d.dealName,
      typed,
      saved: [address, p.buildingDesignation].filter(Boolean).join(", "),
      city,
      state,
      verified,
      fromPin: !!p.pin,
      sf,
      acres,
      reused: false,
      source: p.source ?? "",
    };
    const known = propertyByKey.get(key);
    if (known) {
      report.propertiesReused++;
      check.reused = true;
      report.propertyChecks.push(check);
      const fill: Partial<typeof properties.$inferInsert> = {};
      const building = p.sizeFrom === "building";
      if (sf !== null && known.sf === null) {
        fill.buildingSf = known.sf = sf;
        known.from = p.sizeFrom ?? null;
      } else if (sf !== null && known.sf !== sf) {
        if (building && known.from !== "building") {
          report.sizeConflicts.push(`${known.label}: building size set to ${sf.toLocaleString("en-US")} SF (was ${known.sf!.toLocaleString("en-US")})`);
          fill.buildingSf = known.sf = sf;
          known.from = "building";
        } else {
          report.sizeConflicts.push(`${known.label}: kept ${known.sf!.toLocaleString("en-US")} SF; ${d.dealName} gives ${sf.toLocaleString("en-US")} SF`);
          if (!building) {
            const adds = dealNoteAdds.get(d.sourceRow) ?? [];
            adds.push(`Total size in tracker: ${sf.toLocaleString("en-US")} SF`);
            dealNoteAdds.set(d.sourceRow, adds);
          }
        }
      }
      if (acres !== null && known.acres === null) fill.acreage = String((known.acres = acres));
      if (Object.keys(fill).length) await db.update(properties).set(fill).where(eq(properties.id, known.id));
      return known.id;
    }
    const configuration = CONFIGURATIONS.find((c) => c === p.configuration) ?? null;
    const [row] = await db
      .insert(properties)
      .values({
        name: p.name,
        address: address || null,
        city,
        state,
        zip: match?.zip || p.zip,
        county: match?.county || null,
        buildingDesignation: p.buildingDesignation,
        googlePlaceId: verified ? match!.placeId : null,
        lat: p.pin ? String(p.pin.lat) : match ? String(match.lat) : null,
        lng: p.pin ? String(p.pin.lng) : match ? String(match.lng) : null,
        addressVerified: verified,
        buildingSf: sf,
        acreage: acres === null ? null : String(acres),
        clearHeightFt: p.clearHeightFt === null ? null : String(p.clearHeightFt),
        configuration,
        ...by,
      })
      .returning({ id: properties.id });
    propertyByKey.set(key, { id: row.id, sf, acres, label: check.saved || typed, from: sf !== null || acres !== null ? (p.sizeFrom ?? null) : null });
    report.propertiesCreated++;
    report.propertyChecks.push(check);
    if (!verified) report.unverified.push(`${d.dealName}: ${typed}${p.city ? `, ${p.city}` : ""} ${p.state}`);
    return row.id;
  }

  // Re-run safety: a deal already carrying its tracker row marker is skipped.
  const existing = new Set<number>();
  for (const r of await db.select({ notes: deals.closingNotes }).from(deals).where(like(deals.closingNotes, "%ICM Deal Tracker 10.8, row %"))) {
    const m = r.notes?.match(/ICM Deal Tracker 10\.8, row (\d+)\./);
    if (m) existing.add(Number(m[1]));
  }

  const sellerOwners: { stage: Stage; propertyIds: string[]; companyIds: string[] }[] = [];
  for (const d of rows) {
    if (existing.has(d.sourceRow)) {
      report.skippedExisting.push(d.sourceRow);
      continue;
    }
    for (const message of d.warnings) report.warnings.push({ sourceRow: d.sourceRow, dealName: d.dealName, message });

    const [deal] = await db
      .insert(deals)
      .values({
        dealName: d.dealName,
        category: "Industrial",
        dealType: "Sale",
        represented: "Seller/Landlord",
        stage: d.stage,
        furthestStage: d.furthestStage,
        pitchStatus: d.pitchStatus,
        ...d.dates,
        bovPriceMid: d.bovPriceMid ?? null,
        guidancePrice: d.guidancePrice ?? null,
        closedPrice: d.closedPrice ?? null,
        bovYear1Cap: d.bovYear1Cap ?? null,
        omYear1Cap: d.omYear1Cap ?? null,
        closedYear1Cap: d.closedYear1Cap ?? null,
        totalCommission: d.totalCommission,
        lostToCompanyId: d.lostTo ? await companyId(d.lostTo) : null,
        lostNote: d.lostNote,
        deadNote: d.deadNote,
        closingNotes: d.notes.join("\n"),
        ...by,
      })
      .returning({ id: deals.id });

    const propertyIds: string[] = [];
    for (const p of d.properties) {
      const id = await propertyId(d, p);
      if (propertyIds.includes(id)) continue; // e.g. the same building typed twice
      propertyIds.push(id);
    }
    const adds = dealNoteAdds.get(d.sourceRow);
    if (adds) await db.update(deals).set({ closingNotes: [...d.notes, ...adds].join("\n") }).where(eq(deals.id, deal.id));
    if (propertyIds.length) await db.insert(dealProperties).values(propertyIds.map((propertyId) => ({ dealId: deal.id, propertyId })));

    const sellers: string[] = [];
    for (const p of d.parties) {
      const company = await companyId(p.company);
      const contact = p.contact ? await contactId(company, p.contact) : null;
      await db.insert(dealParties).values({ dealId: deal.id, side: p.side, companyId: company, contactId: contact });
      if (p.side === "A" && !sellers.includes(company)) sellers.push(company);
    }
    if (propertyIds.length && sellers.length) sellerOwners.push({ stage: d.stage, propertyIds, companyIds: sellers });

    for (const m of d.team) {
      const { firstName, lastName } = splitName(m.name);
      const id = streamPeople.get(personKey(firstName, lastName)) ?? streamPeople.get(personKey(m.name, ""));
      if (!id) {
        report.warnings.push({ sourceRow: d.sourceRow, dealName: d.dealName, message: `${m.name} isn't a Stream contact — left off the team` });
        continue;
      }
      await db.insert(dealTeam).values({
        dealId: deal.id,
        contactId: id,
        roles: m.analyst ? ["Analyst"] : [],
        isLeadAnalyst: !!m.lead,
      });
    }

    report.imported.push({ sourceRow: d.sourceRow, dealName: d.dealName, stage: d.stage, properties: propertyIds.length });
  }

  // Current owner = the seller (Haili, 1.6), only where a property has no owner yet —
  // an owner set by a closed sale stays. Active deals get first claim on shared buildings.
  const touched = [...new Set(sellerOwners.flatMap((s) => s.propertyIds))];
  const owned = new Set(
    touched.length
      ? (await db.selectDistinct({ id: propertyOwners.propertyId }).from(propertyOwners).where(inArray(propertyOwners.propertyId, touched))).map(
          (r) => r.id,
        )
      : [],
  );
  sellerOwners.sort((a, b) => OWNER_ORDER.indexOf(a.stage) - OWNER_ORDER.indexOf(b.stage));
  for (const s of sellerOwners) {
    for (const propertyId of s.propertyIds) {
      if (owned.has(propertyId)) continue;
      await db.insert(propertyOwners).values(s.companyIds.map((companyId) => ({ propertyId, companyId })));
      owned.add(propertyId);
      report.ownersSet++;
    }
  }
  return report;
}

/** After a run: deals by stage, read back from the database. */
export async function activeImportCheck(db: Db) {
  const rows = await db
    .select({ stage: deals.stage })
    .from(deals)
    .where(and(like(deals.closingNotes, "%ICM Deal Tracker 10.8, row %")));
  const byStage: Record<string, number> = {};
  for (const r of rows) byStage[r.stage] = (byStage[r.stage] ?? 0) + 1;
  return { total: rows.length, byStage };
}
