import "server-only";
import { and, asc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, dealProperties, deals, properties, propertyOwners, submarkets } from "@/db/schema";

export type Property = typeof properties.$inferSelect;
export type PropertyInput = Omit<
  Property,
  "id" | "createdAt" | "createdById" | "lastModifiedAt" | "lastModifiedById" | "archivedAt"
>;

/** "4500 Mountain Creek Pkwy, Bldg 2" — the address line, without city. */
export function addressLine(p: Pick<Property, "address" | "buildingDesignation">) {
  return [p.address, p.buildingDesignation].filter(Boolean).join(", ") || "(no address)";
}

/** "Mountain Creek 2 · 4500 Mountain Creek Pkwy, Bldg 2 · Dallas, TX" */
export function propertyLabel(p: Pick<Property, "name" | "address" | "buildingDesignation" | "city" | "state">) {
  const place = [p.city, p.state].filter(Boolean).join(", ");
  return [p.name, addressLine(p), place].filter(Boolean).join(" · ");
}

export async function listProperties(opts: { q?: string; archived?: boolean } = {}) {
  const where = [opts.archived ? sql`${properties.archivedAt} is not null` : isNull(properties.archivedAt)];
  if (opts.q?.trim()) {
    const like = `%${opts.q.trim()}%`;
    where.push(
      or(
        ilike(properties.name, like),
        ilike(properties.address, like),
        ilike(properties.city, like),
        ilike(properties.zip, like),
        ilike(properties.buildingDesignation, like),
      )!,
    );
  }
  return db
    .select({
      id: properties.id,
      name: properties.name,
      address: properties.address,
      buildingDesignation: properties.buildingDesignation,
      city: properties.city,
      state: properties.state,
      buildingSf: properties.buildingSf,
      addressVerified: properties.addressVerified,
      submarket: submarkets.name,
      zip: properties.zip,
      county: properties.county,
      acreage: properties.acreage,
      buildingClass: properties.buildingClass,
      yearBuilt: properties.yearBuilt,
      clearHeightFt: properties.clearHeightFt,
      configuration: properties.configuration,
      tenancy: properties.tenancy,
      occupancyPct: properties.occupancyPct,
      dockDoors: properties.dockDoors,
      officeFinishSf: properties.officeFinishSf,
      sprinklerType: properties.sprinklerType,
      lat: properties.lat,
      lng: properties.lng,
      owners: sql<string | null>`(select string_agg(co.name, ', ' order by co.name) from property_owners po join companies co on co.id = po.company_id where po.property_id = "properties"."id")`,
      dealCount: sql<number>`(select count(*)::int from deal_properties dp where dp.property_id = "properties"."id")`,
    })
    .from(properties)
    .leftJoin(submarkets, eq(submarkets.id, properties.submarketId))
    .where(and(...where))
    .orderBy(asc(properties.state), asc(properties.city), asc(properties.address));
}

export async function propertyOptions() {
  const rows = await db
    .select({
      id: properties.id,
      name: properties.name,
      address: properties.address,
      buildingDesignation: properties.buildingDesignation,
      city: properties.city,
      state: properties.state,
    })
    .from(properties)
    .where(isNull(properties.archivedAt))
    .orderBy(asc(properties.address));
  return rows.map((r) => ({ id: r.id, name: propertyLabel(r) }));
}

export async function getProperty(id: string) {
  const [property] = await db.select().from(properties).where(eq(properties.id, id));
  if (!property) return null;
  const owners = await db
    .select({ id: companies.id, name: companies.name })
    .from(propertyOwners)
    .innerJoin(companies, eq(companies.id, propertyOwners.companyId))
    .where(eq(propertyOwners.propertyId, id))
    .orderBy(asc(companies.name));
  // Every deal this property has been part of.
  const dealRows = await db
    .select({ id: deals.id, dealName: deals.dealName, dealType: deals.dealType })
    .from(dealProperties)
    .innerJoin(deals, eq(deals.id, dealProperties.dealId))
    .where(eq(dealProperties.propertyId, id))
    .orderBy(asc(deals.dealName));
  return { property, owners, deals: dealRows };
}

export async function createProperty(input: PropertyInput, ownerIds: string[], byId: string) {
  const [row] = await db
    .insert(properties)
    .values({ ...input, createdById: byId, lastModifiedById: byId })
    .returning({ id: properties.id });
  if (ownerIds.length) {
    await db.insert(propertyOwners).values(ownerIds.map((companyId) => ({ propertyId: row.id, companyId })));
  }
  return row.id;
}

export async function updateProperty(id: string, input: PropertyInput, ownerIds: string[], byId: string) {
  const ops = [
    db
      .update(properties)
      .set({ ...input, lastModifiedAt: new Date(), lastModifiedById: byId })
      .where(eq(properties.id, id)),
    db.delete(propertyOwners).where(eq(propertyOwners.propertyId, id)),
  ] as const;
  if (ownerIds.length) {
    await db.batch([...ops, db.insert(propertyOwners).values(ownerIds.map((companyId) => ({ propertyId: id, companyId })))]);
  } else {
    await db.batch(ops);
  }
}

export async function propertySfTotals(ids: string[]) {
  if (!ids.length) return { sf: 0, acres: 0 };
  const [row] = await db
    .select({
      sf: sql<number>`coalesce(sum(${properties.buildingSf}), 0)::int`,
      acres: sql<number>`coalesce(sum(${properties.acreage}), 0)::float`,
    })
    .from(properties)
    .where(inArray(properties.id, ids));
  return row;
}
