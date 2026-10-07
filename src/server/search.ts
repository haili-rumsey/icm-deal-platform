import "server-only";
import { asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, contacts, dealParties, dealProperties, deals, properties } from "@/db/schema";
import { partyLabel } from "@/domain/options";

/**
 * Global search (PRD §6) across deals, properties, companies and contacts.
 * An address finds the property and every deal it has been part of; a company
 * finds every deal it was a party to, on either side. (Bidders who never won
 * join in 2.1, when bids exist.) Submarket is a report filter, not a search term.
 */

export type DealHit = { id: string; name: string; stage: string; type: string | null; why: string[] };
export type PropertyHit = { id: string; title: string; place: string; archived: boolean };
export type CompanyHit = { id: string; name: string; domain: string | null; archived: boolean };
export type ContactHit = { id: string; name: string; company: string; email: string | null; archived: boolean };
export type SearchResults = { deals: DealHit[]; properties: PropertyHit[]; companies: CompanyHit[]; contacts: ContactHit[] };

/** % and _ are wildcards in LIKE; a search for "50%" means the text. */
const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const propertyTitle = (p: { name: string | null; address: string | null; buildingDesignation: string | null }) =>
  [p.name, [p.address, p.buildingDesignation].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || "(no address)";

export async function search(query: string, limit: number): Promise<SearchResults> {
  const q = query.trim();
  if (q.length < 2) return { deals: [], properties: [], companies: [], contacts: [] };
  const pat = like(q);
  // Phone numbers are typed every which way; compare digits when the search has enough of them.
  const digits = q.replace(/\D/g, "");
  const phoneMatch = digits.length >= 4 ? sql`regexp_replace(coalesce(${contacts.phone}, ''), '\\D', '', 'g') like ${`%${digits}%`}` : undefined;

  const [propertyRows, companyRows, contactRows, dealRows] = await Promise.all([
    db
      .select({
        id: properties.id,
        name: properties.name,
        address: properties.address,
        buildingDesignation: properties.buildingDesignation,
        city: properties.city,
        state: properties.state,
        archivedAt: properties.archivedAt,
      })
      .from(properties)
      .where(or(ilike(properties.address, pat), ilike(properties.name, pat), ilike(properties.city, pat), ilike(properties.zip, pat)))
      .orderBy(asc(properties.address))
      .limit(limit),
    db
      .select({ id: companies.id, name: companies.name, domain: companies.websiteDomain, archivedAt: companies.archivedAt })
      .from(companies)
      .where(or(ilike(companies.name, pat), ilike(companies.websiteDomain, pat)))
      .orderBy(asc(companies.name))
      .limit(limit),
    db
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        company: companies.name,
        archivedAt: contacts.archivedAt,
      })
      .from(contacts)
      .innerJoin(companies, eq(companies.id, contacts.companyId))
      .where(
        or(
          sql`(${contacts.firstName} || ' ' || ${contacts.lastName}) ilike ${pat}`,
          sql`(${contacts.lastName} || ', ' || ${contacts.firstName}) ilike ${pat}`,
          ilike(contacts.email, pat),
          phoneMatch,
        ),
      )
      .orderBy(asc(contacts.lastName), asc(contacts.firstName))
      .limit(limit),
    db
      .select({ id: deals.id, name: deals.dealName, stage: deals.stage, type: deals.dealType, reappsId: deals.reappsId })
      .from(deals)
      .where(or(ilike(deals.dealName, pat), ilike(deals.reappsId, pat)))
      .orderBy(desc(deals.lastModifiedAt))
      .limit(limit),
  ]);

  // Deals reached through a matching property or company, with why they're here.
  const why = new Map<string, Set<string>>();
  const note = (id: string, reason: string) => why.set(id, (why.get(id) ?? new Set()).add(reason));
  for (const d of dealRows) note(d.id, d.reappsId && d.reappsId.toLowerCase().includes(q.toLowerCase()) ? `REApps ID ${d.reappsId}` : "Deal name");

  const propertyIds = propertyRows.map((p) => p.id);
  const companyIds = companyRows.map((c) => c.id);
  const [viaProperty, viaCompany] = await Promise.all([
    propertyIds.length
      ? db
          .select({ dealId: dealProperties.dealId, propertyId: dealProperties.propertyId })
          .from(dealProperties)
          .where(inArray(dealProperties.propertyId, propertyIds))
      : [],
    companyIds.length
      ? db
          .select({ dealId: dealParties.dealId, companyId: dealParties.companyId, side: dealParties.side, dealType: deals.dealType })
          .from(dealParties)
          .innerJoin(deals, eq(deals.id, dealParties.dealId))
          .where(inArray(dealParties.companyId, companyIds))
      : [],
  ]);
  const propertyName = new Map(propertyRows.map((p) => [p.id, p.address ?? p.name ?? "property"]));
  const companyName = new Map(companyRows.map((c) => [c.id, c.name]));
  for (const r of viaProperty) note(r.dealId, `Property: ${propertyName.get(r.propertyId)}`);
  for (const r of viaCompany) note(r.dealId, `${partyLabel(r.dealType, r.side)}: ${companyName.get(r.companyId)}`);

  const extraIds = [...why.keys()].filter((id) => !dealRows.some((d) => d.id === id));
  const extra = extraIds.length
    ? await db
        .select({ id: deals.id, name: deals.dealName, stage: deals.stage, type: deals.dealType })
        .from(deals)
        .where(inArray(deals.id, extraIds))
        .orderBy(desc(deals.lastModifiedAt))
    : [];

  return {
    // Name matches first, then deals found through a property or company.
    deals: [...dealRows, ...extra].map((d) => ({
      id: d.id,
      name: d.name,
      stage: d.stage,
      type: d.type,
      why: [...(why.get(d.id) ?? [])],
    })),
    properties: propertyRows.map((p) => ({
      id: p.id,
      title: propertyTitle(p),
      place: [p.city, p.state].filter(Boolean).join(", "),
      archived: !!p.archivedAt,
    })),
    companies: companyRows.map((c) => ({ id: c.id, name: c.name, domain: c.domain, archived: !!c.archivedAt })),
    contacts: contactRows.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
      company: c.company,
      email: c.email,
      archived: !!c.archivedAt,
    })),
  };
}
