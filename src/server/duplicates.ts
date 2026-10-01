import "server-only";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, contacts, properties } from "@/db/schema";
import { websiteDomain } from "./companies";
import { normalizeContactEmail } from "./contacts";
import { propertyLabel } from "./properties";

/**
 * Possible duplicates, for warnings only — the user can always carry on.
 * Keys (PRD): companies on website domain, contacts on email, properties on
 * Google place_id + building designation.
 */
export type Match = { id: string; label: string; href: string; detail?: string | null };

export async function companiesWithDomain(website: string, excludeId?: string): Promise<Match[]> {
  const domain = websiteDomain(website);
  if (!domain) return [];
  const rows = await db
    .select({ id: companies.id, name: companies.name, archivedAt: companies.archivedAt })
    .from(companies)
    .where(and(eq(companies.websiteDomain, domain), excludeId ? ne(companies.id, excludeId) : undefined));
  return rows.map((r) => ({
    id: r.id,
    label: r.name,
    href: `/companies/${r.id}`,
    detail: r.archivedAt ? "archived" : domain,
  }));
}

export async function contactsWithEmail(email: string, excludeId?: string): Promise<Match[]> {
  const address = normalizeContactEmail(email);
  if (!address) return [];
  const rows = await db
    .select({
      id: contacts.id,
      name: sql<string>`${contacts.firstName} || ' ' || ${contacts.lastName}`,
      company: companies.name,
      archivedAt: contacts.archivedAt,
    })
    .from(contacts)
    .innerJoin(companies, eq(companies.id, contacts.companyId))
    .where(and(eq(contacts.email, address), excludeId ? ne(contacts.id, excludeId) : undefined));
  return rows.map((r) => ({
    id: r.id,
    label: r.name,
    href: `/contacts/${r.id}`,
    // Showing the current company helps spot someone who has changed firms.
    detail: r.archivedAt ? `${r.company} · archived` : r.company,
  }));
}

/**
 * Properties at the same Google place. Building designation tells apart buildings
 * that share an address, so a match with a *different* designation is shown as
 * "same address" rather than "same property".
 */
export async function propertiesAtPlace(
  placeId: string,
  buildingDesignation: string | null,
  excludeId?: string,
): Promise<(Match & { sameBuilding: boolean })[]> {
  if (!placeId) return [];
  const rows = await db
    .select({
      id: properties.id,
      address: properties.address,
      buildingDesignation: properties.buildingDesignation,
      city: properties.city,
      state: properties.state,
    })
    .from(properties)
    .where(
      and(eq(properties.googlePlaceId, placeId), isNull(properties.archivedAt), excludeId ? ne(properties.id, excludeId) : undefined),
    );
  const norm = (s: string | null) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return rows.map((r) => ({
    id: r.id,
    label: propertyLabel(r),
    href: `/properties/${r.id}`,
    detail: r.buildingDesignation ? `Building: ${r.buildingDesignation}` : "No building designation",
    sameBuilding: norm(r.buildingDesignation) === norm(buildingDesignation),
  }));
}
