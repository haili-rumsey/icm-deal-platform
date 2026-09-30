import "server-only";
import { and, asc, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { companies, contacts, dealParties, dealProperties, deals, dealTeam, properties, users } from "@/db/schema";
import type { Side } from "@/domain/options";
import { SUBTYPES_BY_TYPE } from "@/domain/options";

export type Deal = typeof deals.$inferSelect;
export type DealInput = Omit<
  Deal,
  "id" | "createdAt" | "createdById" | "lastModifiedAt" | "lastModifiedById" | "archivedAt"
>;
type TeamRole = (typeof dealTeam.$inferSelect)["roles"][number];

/** Subtype only applies when it belongs to the deal type (e.g. none for Lease). */
function cleanSubtype(input: DealInput): DealInput {
  const allowed = input.dealType ? SUBTYPES_BY_TYPE[input.dealType] : [];
  return { ...input, dealSubtype: input.dealSubtype && allowed.includes(input.dealSubtype) ? input.dealSubtype : null };
}

export async function listDeals(opts: { q?: string; archived?: boolean } = {}) {
  const where = [opts.archived ? sql`${deals.archivedAt} is not null` : isNull(deals.archivedAt)];
  if (opts.q?.trim()) where.push(ilike(deals.dealName, `%${opts.q.trim()}%`));
  return db
    .select({
      id: deals.id,
      dealName: deals.dealName,
      dealType: deals.dealType,
      category: deals.category,
      isIos: deals.isIos,
      lastModifiedAt: deals.lastModifiedAt,
      propertyCount: sql<number>`(select count(*)::int from deal_properties dp where dp.deal_id = "deals"."id")`,
      totalSf: sql<number>`(select coalesce(sum(p.building_sf), 0)::int from deal_properties dp join properties p on p.id = dp.property_id where dp.deal_id = "deals"."id")`,
      leadAnalyst: sql<string | null>`(select c.first_name || ' ' || c.last_name from deal_team t join contacts c on c.id = t.contact_id where t.deal_id = "deals"."id" and t.is_lead_analyst limit 1)`,
    })
    .from(deals)
    .where(and(...where))
    .orderBy(desc(deals.lastModifiedAt));
}

const modifiedBy = alias(users, "modified_by");
const referral = alias(contacts, "referral");

export async function getDeal(id: string) {
  const [[row], propertyRows, partyRows, teamRows] = await Promise.all([
    db
    .select({
      deal: deals,
      modifiedByName: modifiedBy.name,
      referralName: sql<string | null>`${referral.firstName} || ' ' || ${referral.lastName}`,
    })
    .from(deals)
    .leftJoin(modifiedBy, eq(modifiedBy.id, deals.lastModifiedById))
    .leftJoin(referral, eq(referral.id, deals.referralContactId))
    .where(eq(deals.id, id)),
    db
      .select({
        id: properties.id,
        address: properties.address,
        buildingDesignation: properties.buildingDesignation,
        city: properties.city,
        state: properties.state,
        buildingSf: properties.buildingSf,
        acreage: properties.acreage,
        addressVerified: properties.addressVerified,
        allocatedPrice: dealProperties.allocatedPrice,
      })
      .from(dealProperties)
      .innerJoin(properties, eq(properties.id, dealProperties.propertyId))
      .where(eq(dealProperties.dealId, id))
      .orderBy(asc(properties.address)),
    db
      .select({
        id: dealParties.id,
        side: dealParties.side,
        companyId: companies.id,
        companyName: companies.name,
        contactId: contacts.id,
        contactName: sql<string | null>`${contacts.firstName} || ' ' || ${contacts.lastName}`,
      })
      .from(dealParties)
      .innerJoin(companies, eq(companies.id, dealParties.companyId))
      .leftJoin(contacts, eq(contacts.id, dealParties.contactId))
      .where(eq(dealParties.dealId, id))
      .orderBy(asc(companies.name)),
    db
      .select({
        id: dealTeam.id,
        contactId: contacts.id,
        name: sql<string>`${contacts.firstName} || ' ' || ${contacts.lastName}`,
        roles: dealTeam.roles,
        isLeadBroker: dealTeam.isLeadBroker,
        isLeadAnalyst: dealTeam.isLeadAnalyst,
      })
      .from(dealTeam)
      .innerJoin(contacts, eq(contacts.id, dealTeam.contactId))
      .where(eq(dealTeam.dealId, id))
      .orderBy(asc(contacts.lastName)),
  ]);
  if (!row) return null;

  return { ...row, properties: propertyRows, parties: partyRows, team: teamRows };
}

export async function createDeal(input: DealInput, byId: string) {
  const [row] = await db
    .insert(deals)
    .values({ ...cleanSubtype(input), createdById: byId, lastModifiedById: byId })
    .returning({ id: deals.id });
  return row.id;
}

export async function updateDeal(id: string, input: DealInput, byId: string) {
  await db
    .update(deals)
    .set({ ...cleanSubtype(input), lastModifiedAt: new Date(), lastModifiedById: byId })
    .where(eq(deals.id, id));
}

/** Any change to a deal's properties, parties or team counts as modifying the deal. */
function touch(dealId: string, byId: string) {
  return db.update(deals).set({ lastModifiedAt: new Date(), lastModifiedById: byId }).where(eq(deals.id, dealId));
}

// ---- Properties on a deal ----

export async function addDealProperty(dealId: string, propertyId: string, allocatedPrice: string | null, byId: string) {
  await db.batch([
    db
      .insert(dealProperties)
      .values({ dealId, propertyId, allocatedPrice })
      .onConflictDoUpdate({ target: [dealProperties.dealId, dealProperties.propertyId], set: { allocatedPrice } }),
    touch(dealId, byId),
  ]);
}

export async function removeDealProperty(dealId: string, propertyId: string, byId: string) {
  await db.batch([
    db.delete(dealProperties).where(and(eq(dealProperties.dealId, dealId), eq(dealProperties.propertyId, propertyId))),
    touch(dealId, byId),
  ]);
}

// ---- Parties ----

export async function addDealParty(dealId: string, side: Side, companyId: string, contactId: string | null, byId: string) {
  await db.batch([db.insert(dealParties).values({ dealId, side, companyId, contactId }), touch(dealId, byId)]);
}

export async function removeDealParty(dealId: string, partyId: string, byId: string) {
  await db.batch([
    db.delete(dealParties).where(and(eq(dealParties.id, partyId), eq(dealParties.dealId, dealId))),
    touch(dealId, byId),
  ]);
}

// ---- Team ----

export type TeamInput = { contactId: string; roles: TeamRole[]; isLeadBroker: boolean; isLeadAnalyst: boolean };

/** Adds or updates a person. Making someone lead analyst clears it from anyone else on the deal. */
export async function saveTeamMember(dealId: string, input: TeamInput, byId: string) {
  const clearAnalyst = db
    .update(dealTeam)
    .set({ isLeadAnalyst: false })
    .where(and(eq(dealTeam.dealId, dealId), eq(dealTeam.isLeadAnalyst, true)));
  const upsert = db
    .insert(dealTeam)
    .values({ dealId, ...input })
    .onConflictDoUpdate({
      target: [dealTeam.dealId, dealTeam.contactId],
      set: { roles: input.roles, isLeadBroker: input.isLeadBroker, isLeadAnalyst: input.isLeadAnalyst },
    });
  if (input.isLeadAnalyst) await db.batch([clearAnalyst, upsert, touch(dealId, byId)]);
  else await db.batch([upsert, touch(dealId, byId)]);
}

export async function removeTeamMember(dealId: string, teamId: string, byId: string) {
  await db.batch([
    db.delete(dealTeam).where(and(eq(dealTeam.id, teamId), eq(dealTeam.dealId, dealId))),
    touch(dealId, byId),
  ]);
}
