import "server-only";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { companies, contacts, dealParties, dealProperties, deals, dealTeam, properties } from "@/db/schema";
import { personKey, type ImportDeal, type ImportProperty } from "@/domain/historical-import";
import type { GeocodeMatch } from "./geocode";

/**
 * Writes prepared historical deals (see src/domain/historical-import.ts). Meant to
 * run inside one transaction so a practice run can be rolled back and a real run
 * either lands whole or not at all. Safe to re-run: a deal whose REApps ID is
 * already in the system is skipped, and companies, people and properties are
 * matched before anything new is created.
 */
type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Address → Google's match, or null to keep it as typed (flagged unverified). */
export type Geocoder = (p: ImportProperty) => Promise<GeocodeMatch | null>;

export type ImportReport = {
  imported: string[];
  skippedExisting: string[];
  companiesCreated: string[];
  companiesRenamed: string[];
  contactsCreated: string[];
  propertiesCreated: number;
  propertiesReused: number;
  unverified: string[];
  sizeConflicts: string[];
  warnings: { reappsId: string; message: string }[];
};

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function splitName(full: string) {
  const [first, ...rest] = full.trim().split(/\s+/);
  return { firstName: first, lastName: rest.join(" ") };
}

export async function importDeals(
  db: Db,
  rows: ImportDeal[],
  opts: { byId: string; geocode: Geocoder; renameExisting?: Record<string, string> },
): Promise<ImportReport> {
  const report: ImportReport = {
    imported: [],
    skippedExisting: [],
    companiesCreated: [],
    companiesRenamed: [],
    contactsCreated: [],
    propertiesCreated: 0,
    propertiesReused: 0,
    unverified: [],
    sizeConflicts: [],
    warnings: [],
  };
  const by = { createdById: opts.byId, lastModifiedById: opts.byId };

  for (const [from, to] of Object.entries(opts.renameExisting ?? {})) {
    const renamed = await db
      .update(companies)
      .set({ name: to, lastModifiedAt: new Date(), lastModifiedById: opts.byId })
      .where(sql`lower(${companies.name}) = lower(${from})`)
      .returning({ id: companies.id });
    if (renamed.length) report.companiesRenamed.push(`${from} → ${to}`);
  }

  // ---- What's already in the system ----
  const existingIds = new Set(
    (await db.select({ id: deals.reappsId }).from(deals).where(isNotNull(deals.reappsId))).map((r) => r.id!.trim()),
  );
  const companyByName = new Map<string, string>();
  let streamId = "";
  for (const c of await db.select({ id: companies.id, name: companies.name, key: companies.systemKey }).from(companies)) {
    if (!companyByName.has(norm(c.name)) || c.key) companyByName.set(norm(c.name), c.id);
    if (c.key === "stream") streamId = c.id;
  }
  if (!streamId) throw new Error("The Stream Realty Partners company is missing. Run the seed first.");
  const contactByKey = new Map<string, string>(); // company id + person key
  for (const c of await db
    .select({ id: contacts.id, companyId: contacts.companyId, first: contacts.firstName, last: contacts.lastName })
    .from(contacts)) {
    contactByKey.set(`${c.companyId}|${personKey(c.first, c.last)}`, c.id);
  }
  type Known = { id: string; sf: number | null; acres: number | null; label: string };
  const propertyByKey = new Map<string, Known>();
  const keyFor = (placeId: string | null, address: string, city: string, designation: string | null | undefined) =>
    placeId ? `place|${placeId}|${norm(designation)}` : `text|${norm(address)}|${norm(city)}|${norm(designation)}`;
  for (const p of await db.select().from(properties)) {
    propertyByKey.set(keyFor(p.googlePlaceId, p.address ?? "", p.city ?? "", p.buildingDesignation), {
      id: p.id,
      sf: p.buildingSf,
      acres: p.acreage === null ? null : Number(p.acreage),
      label: p.address ?? "(no address)",
    });
  }

  // Holding entities behind each new company, noted on the company for traceability.
  const entitiesByCompany = new Map<string, Set<string>>();
  for (const d of rows) {
    for (const p of d.parties) {
      if (norm(p.sourceName) === norm(p.company)) continue;
      const set = entitiesByCompany.get(norm(p.company)) ?? new Set();
      set.add(p.sourceName);
      entitiesByCompany.set(norm(p.company), set);
    }
  }

  async function companyId(name: string, note: string | null | undefined) {
    const found = companyByName.get(norm(name));
    if (found) return found;
    const entities = [...(entitiesByCompany.get(norm(name)) ?? [])];
    const notes = [
      note,
      entities.length ? `Holding entities in accounting's closed-deal export: ${entities.join("; ")}.` : null,
    ]
      .filter(Boolean)
      .join("\n");
    // No website yet: the company form asks for one (or "none") the next time it's saved.
    const [row] = await db
      .insert(companies)
      .values({ name, notes: notes || null, ...by })
      .returning({ id: companies.id });
    companyByName.set(norm(name), row.id);
    report.companiesCreated.push(name);
    return row.id;
  }

  async function contactId(company: string, firstName: string, lastName: string, notes?: string) {
    const key = `${company}|${personKey(firstName, lastName)}`;
    const found = contactByKey.get(key);
    if (found) return found;
    const [row] = await db
      .insert(contacts)
      .values({ companyId: company, firstName, lastName, notes: notes ?? null, ...by })
      .returning({ id: contacts.id });
    contactByKey.set(key, row.id);
    report.contactsCreated.push(`${firstName} ${lastName}`.trim());
    return row.id;
  }

  async function propertyId(p: ImportProperty) {
    const match = await opts.geocode(p);
    // Google gives one street number; keep a range as written ("1700-1750 …") and use Google for the rest.
    const range = /^\d+\s*-\s*\d+/.test(p.address);
    const address = match && !range ? match.address : p.address.replace(/^(\d+)\s*-\s*(\d+)/, "$1-$2");
    const city = match?.city || p.city;
    const key = keyFor(match?.placeId ?? null, address, city, p.buildingDesignation);
    const sf = p.buildingSf ?? null;
    const acres = p.acreage ?? null;
    const known = propertyByKey.get(key);
    if (known) {
      report.propertiesReused++;
      // One size per property: keep the first figure, fill gaps, report disagreements.
      const fill: Partial<typeof properties.$inferInsert> = {};
      if (sf !== null && known.sf === null) fill.buildingSf = known.sf = sf;
      else if (sf !== null && known.sf !== sf) report.sizeConflicts.push(`${known.label}: ${known.sf} SF kept, ${sf} SF on another deal`);
      if (acres !== null && known.acres === null) fill.acreage = String((known.acres = acres));
      else if (acres !== null && known.acres !== acres)
        report.sizeConflicts.push(`${known.label}: ${known.acres} acres kept, ${acres} acres on another deal`);
      if (Object.keys(fill).length) await db.update(properties).set(fill).where(eq(properties.id, known.id));
      return known.id;
    }
    const [row] = await db
      .insert(properties)
      .values({
        name: p.name ?? null,
        address,
        city,
        state: match?.state || p.state,
        zip: match?.zip || null,
        county: match?.county || null,
        buildingDesignation: p.buildingDesignation ?? null,
        googlePlaceId: match?.placeId ?? null,
        lat: match ? String(match.lat) : null,
        lng: match ? String(match.lng) : null,
        addressVerified: !!match,
        buildingSf: sf,
        acreage: acres === null ? null : String(acres),
        ...by,
      })
      .returning({ id: properties.id });
    const label = [p.address, p.buildingDesignation].filter(Boolean).join(", ");
    propertyByKey.set(key, { id: row.id, sf, acres, label });
    report.propertiesCreated++;
    if (!match) report.unverified.push(`${label}, ${p.city} ${p.state}`);
    return row.id;
  }

  for (const d of rows) {
    if (existingIds.has(d.reappsId)) {
      report.skippedExisting.push(d.reappsId);
      continue;
    }
    for (const message of d.warnings) report.warnings.push({ reappsId: d.reappsId, message });

    const [deal] = await db
      .insert(deals)
      .values({
        dealName: d.dealName,
        reappsId: d.reappsId,
        category: d.category,
        dealType: d.dealType,
        represented: d.represented,
        isIos: d.isIos,
        stage: "Closed",
        closeDate: d.closeDate,
        closedPrice: d.closedPrice,
        totalCapitalization: d.totalCapitalization,
        loanAmount: d.loanAmount,
        totalLeaseConsideration: d.totalLeaseConsideration,
        totalCommission: d.totalCommission,
        outsideCommission: d.outsideCommission,
        inHouseGross: d.inHouseGross,
        inHouseGrossManual: d.inHouseGrossManual,
        closingNotes: d.closingNotes,
        ...by,
      })
      .returning({ id: deals.id });
    existingIds.add(d.reappsId);

    const propertyIds = new Set<string>();
    for (const p of d.properties) {
      const id = await propertyId(p);
      if (propertyIds.has(id)) report.warnings.push({ reappsId: d.reappsId, message: `Two addresses matched one property (${p.address}).` });
      propertyIds.add(id);
    }
    if (propertyIds.size) {
      await db.insert(dealProperties).values([...propertyIds].map((propertyId) => ({ dealId: deal.id, propertyId })));
    }

    for (const p of d.parties) {
      const company = await companyId(p.company, p.companyNote);
      const person = p.contact ? splitName(p.contact) : null;
      const contact = person ? await contactId(company, person.firstName, person.lastName) : null;
      await db.insert(dealParties).values({ dealId: deal.id, side: p.side, companyId: company, contactId: contact });
    }

    const team = new Set<string>();
    for (const b of d.brokers) {
      team.add(await contactId(streamId, b.firstName, b.lastName, b.former ? "Former employee." : undefined));
    }
    if (team.size) await db.insert(dealTeam).values([...team].map((contactId) => ({ dealId: deal.id, contactId })));

    report.imported.push(d.reappsId);
  }
  return report;
}

/** After a run: what actually landed, read back from the database. */
export async function importCheck(db: Db, reappsIds: string[]) {
  if (!reappsIds.length) return { deals: 0, closed: 0, ios: 0, iosSales: 0, iosLeases: 0 };
  const where = inArray(deals.reappsId, reappsIds);
  const [row] = await db
    .select({
      deals: sql<number>`count(*)::int`,
      closed: sql<number>`count(*) filter (where ${deals.stage} = 'Closed')::int`,
      ios: sql<number>`count(*) filter (where ${deals.isIos})::int`,
      iosSales: sql<number>`count(*) filter (where ${deals.isIos} and ${deals.dealType} = 'Sale')::int`,
      iosLeases: sql<number>`count(*) filter (where ${deals.isIos} and ${deals.dealType} = 'Lease')::int`,
    })
    .from(deals)
    .where(and(where));
  return row;
}
