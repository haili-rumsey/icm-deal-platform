import "server-only";
import { and, asc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, dealProperties, deals, properties, propertyOwners, submarkets } from "@/db/schema";

export type Property = typeof properties.$inferSelect;
export type PropertyInput = Omit<
  Property,
  "id" | "createdAt" | "createdById" | "lastModifiedAt" | "lastModifiedById" | "archivedAt" | "pinManual"
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
      pinManual: properties.pinManual,
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
      // Where the property's deals stand, using the sidebar's groups: an active deal wins,
      // then closed, then Track/Dead/Lost ("Archive").
      dealStatus: sql<"Active" | "Closed" | "Archive" | "No deals">`(
        select case
          when bool_or(d.stage in ('BOV 1','BOV 2','Engaged','Marketing','Awarded','Under Contract','Off Market')) then 'Active'
          when bool_or(d.stage = 'Closed') then 'Closed'
          when count(*) > 0 then 'Archive'
          else 'No deals' end
        from deal_properties dp join deals d on d.id = dp.deal_id
        where dp.property_id = "properties"."id")`,
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
  // A pin placed by hand stays put, whatever the address lookup says.
  const [current] = await db.select({ pinManual: properties.pinManual }).from(properties).where(eq(properties.id, id));
  const { lat, lng, ...rest } = input;
  const set = current?.pinManual ? rest : { ...rest, lat, lng };
  const ops = [
    db
      .update(properties)
      .set({ ...set, lastModifiedAt: new Date(), lastModifiedById: byId })
      .where(eq(properties.id, id)),
    db.delete(propertyOwners).where(eq(propertyOwners.propertyId, id)),
  ] as const;
  if (ownerIds.length) {
    await db.batch([...ops, db.insert(propertyOwners).values(ownerIds.map((companyId) => ({ propertyId: id, companyId })))]);
  } else {
    await db.batch(ops);
  }
}

// ---- One record per building (Haili, 1.6) ----

const sameDesignation = (col: typeof properties.buildingDesignation, designation: string | null) =>
  sql`lower(trim(coalesce(${col}, ''))) = lower(trim(${designation ?? ""}))`;

export type Place = { placeId: string | null; address: string | null; city: string | null; state: string | null };

/**
 * Same Google place. Google can give one address two place IDs (typed suggestion vs.
 * direct lookup), so a Google-matched property at the same street, city and state counts too.
 */
export function samePlace(p: Place) {
  const byId = p.placeId ? eq(properties.googlePlaceId, p.placeId) : undefined;
  const byAddress =
    p.address && p.state
      ? sql`(${properties.addressVerified} and lower(trim(${properties.address})) = lower(trim(${p.address}))
            and lower(trim(coalesce(${properties.city}, ''))) = lower(trim(${p.city ?? ""})) and upper(${properties.state}) = upper(${p.state}))`
      : undefined;
  return byId && byAddress ? or(byId, byAddress) : (byId ?? byAddress ?? sql`false`);
}

/** The building already in the system at this Google place (same building designation), if any. */
export async function findSameBuilding(place: Place, designation: string | null, excludeId?: string) {
  if (!place.placeId) return null;
  const [row] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(
      and(
        samePlace(place),
        sameDesignation(properties.buildingDesignation, designation),
        isNull(properties.archivedAt),
        excludeId ? sql`${properties.id} <> ${excludeId}` : undefined,
      ),
    )
    .orderBy(asc(properties.createdAt))
    .limit(1);
  return row?.id ?? null;
}

/** Facts copied onto the kept building only where it has none (never overwriting). */
const FILLABLE = [
  "name", "submarket_id", "building_sf", "acreage", "occupancy_pct", "tenancy", "building_class", "year_built",
  "clear_height_ft", "configuration", "dock_doors", "office_finish_sf", "sprinkler_type",
] as const;

/** Fills the kept building's blanks from a new property form that matched it. */
export async function fillBlanks(id: string, input: PropertyInput, ownerIds: string[], byId: string) {
  const [current] = await db.select().from(properties).where(eq(properties.id, id));
  if (!current) return;
  const keys = ["name", "submarketId", "buildingSf", "acreage", "occupancyPct", "tenancy", "buildingClass", "yearBuilt", "clearHeightFt", "configuration", "dockDoors", "officeFinishSf", "sprinklerType"] as const;
  const set: Record<string, unknown> = {};
  for (const k of keys) if (current[k] === null && input[k] !== null) set[k] = input[k];
  if (Object.keys(set).length) await db.update(properties).set({ ...set, lastModifiedAt: new Date(), lastModifiedById: byId }).where(eq(properties.id, id));
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(propertyOwners).where(eq(propertyOwners.propertyId, id));
  if (n === 0 && ownerIds.length) await db.insert(propertyOwners).values(ownerIds.map((companyId) => ({ propertyId: id, companyId })));
}

/**
 * Merges a duplicate building into the one being kept: its deals move over, its facts
 * fill the kept building's blanks, its owners are used if the kept building has none,
 * then the duplicate is removed. All in one transaction.
 */
export async function mergeProperty(fromId: string, intoId: string, byId: string) {
  if (fromId === intoId) return;
  const fill = sql.join(
    FILLABLE.map((c) => sql`${sql.identifier(c)} = coalesce(keep.${sql.identifier(c)}, dup.${sql.identifier(c)})`),
    sql`, `,
  );
  await db.batch([
    db.execute(sql`
      update properties keep set ${fill}, last_modified_at = now(), last_modified_by_id = ${byId}
      from properties dup where keep.id = ${intoId} and dup.id = ${fromId}`),
    db.execute(sql`
      insert into deal_properties (deal_id, property_id)
      select deal_id, ${intoId} from deal_properties where property_id = ${fromId}
      on conflict do nothing`),
    db.execute(sql`
      insert into property_owners (property_id, company_id)
      select ${intoId}, company_id from property_owners
      where property_id = ${fromId} and not exists (select 1 from property_owners where property_id = ${intoId})`),
    db.delete(dealProperties).where(eq(dealProperties.propertyId, fromId)),
    db.delete(propertyOwners).where(eq(propertyOwners.propertyId, fromId)),
    db.delete(properties).where(eq(properties.id, fromId)),
  ]);
}

/** Adjust pin: the spot dragged to on the map, kept over later address lookups. */
export async function setPropertyPin(id: string, lat: number, lng: number, byId: string) {
  await db
    .update(properties)
    .set({ lat: lat.toFixed(7), lng: lng.toFixed(7), pinManual: true, lastModifiedAt: new Date(), lastModifiedById: byId })
    .where(eq(properties.id, id));
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
