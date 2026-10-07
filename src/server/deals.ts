import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { companies, contacts, dealParties, dealProperties, deals, dealTeam, properties, submarkets, users } from "@/db/schema";
import type { Side } from "@/domain/options";
import { SUBTYPES_BY_TYPE, type Stage } from "@/domain/options";
import { closeBlockers, type CloseCheckInput } from "@/domain/close-check";
import { ACTIVE_STAGES, furthestOf, furthestStageLocked, STAGE_DATE } from "@/domain/stages";

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

/** In-house gross defaults to total − outside commission unless someone typed over it. */
function withInHouseGross(input: DealInput): DealInput {
  if (input.inHouseGrossManual) return input;
  const total = input.totalCommission === null ? null : Number(input.totalCommission);
  const outside = input.outsideCommission === null ? 0 : Number(input.outsideCommission);
  return { ...input, inHouseGross: total === null ? null : (total - outside).toFixed(2) };
}

function prepare(input: DealInput): DealInput {
  return withInHouseGross(cleanSubtype(input));
}

// ---- Closed-deal lock (PRD §3) ----

/** Closed deals are read-only for everyone except the three admins. */
export function isLockedFor(stage: string, user: { isAdmin: boolean }) {
  return stage === "Closed" && !user.isAdmin;
}

export class DealLockedError extends Error {
  constructor() {
    super("This deal is closed. Only Haili Rumsey, Seth Koschak and Matteson Hamilton can change it.");
  }
}

/** Throws if this user may not change this deal. Call before every deal change. */
export async function assertCanEdit(dealId: string, user: { isAdmin: boolean }) {
  const [row] = await db.select({ stage: deals.stage }).from(deals).where(eq(deals.id, dealId));
  if (row && isLockedFor(row.stage, user)) throw new DealLockedError();
}

export type DealView = "active" | "closed" | "inactive" | "pipeline" | "all";

const VIEW_STAGES: Record<Exclude<DealView, "all">, Stage[]> = {
  active: ACTIVE_STAGES,
  closed: ["Closed"],
  // The Archive page: everything parked — Track, Dead and Lost in one list.
  inactive: ["Track", "Dead", "Lost"],
  // The Pipeline report: active stages only (Track lives on the Archive list — Haili, 1.6).
  pipeline: ACTIVE_STAGES,
};

export async function listDeals(opts: { q?: string; archived?: boolean; view?: DealView } = {}) {
  const where = [opts.archived ? sql`${deals.archivedAt} is not null` : isNull(deals.archivedAt)];
  if (opts.q?.trim()) where.push(ilike(deals.dealName, `%${opts.q.trim()}%`));
  if (opts.view && opts.view !== "all" && !opts.archived) where.push(inArray(deals.stage, VIEW_STAGES[opts.view]));
  return db
    .select({
      id: deals.id,
      dealName: deals.dealName,
      dealType: deals.dealType,
      category: deals.category,
      isIos: deals.isIos,
      stage: deals.stage,
      bovPriceMid: deals.bovPriceMid,
      guidancePrice: deals.guidancePrice,
      closedPrice: deals.closedPrice,
      totalCapitalization: deals.totalCapitalization,
      loanAmount: deals.loanAmount,
      totalLeaseConsideration: deals.totalLeaseConsideration,
      totalCommission: deals.totalCommission,
      lastModifiedAt: deals.lastModifiedAt,
      propertyCount: sql<number>`(select count(*)::int from deal_properties dp where dp.deal_id = "deals"."id")`,
      totalSf: sql<number>`(select coalesce(sum(p.building_sf), 0)::int from deal_properties dp join properties p on p.id = dp.property_id where dp.deal_id = "deals"."id")`,
      totalAcres: sql<number | null>`(select sum(p.acreage)::float from deal_properties dp join properties p on p.id = dp.property_id where dp.deal_id = "deals"."id")`,
      furthestStage: deals.furthestStage,
      lostNote: deals.lostNote,
      deadNote: deals.deadNote,
      lostTo: sql<string | null>`(select co.name from companies co where co.id = "deals"."lost_to_company_id")`,
      leadAnalyst: sql<string | null>`(select c.first_name || ' ' || c.last_name from deal_team t join contacts c on c.id = t.contact_id where t.deal_id = "deals"."id" and t.is_lead_analyst limit 1)`,
      // "Haili R." — the Pipeline report's short form.
      leadAnalystShort: sql<string | null>`(select c.first_name || ' ' || left(c.last_name, 1) || '.' from deal_team t join contacts c on c.id = t.contact_id where t.deal_id = "deals"."id" and t.is_lead_analyst limit 1)`,
      // Extra columns offered under "Edit columns".
      reappsId: deals.reappsId,
      closeDate: deals.closeDate,
      wonDate: deals.wonDate,
      launchDate: deals.launchDate,
      pitchDueDate: deals.pitchDueDate,
      pitchDate: deals.pitchDate,
      callForOffersDate: deals.callForOffersDate,
      awardedDate: deals.awardedDate,
      ddExpirationDate: deals.ddExpirationDate,
      followUpDate: deals.followUpDate,
      dealSubtype: deals.dealSubtype,
      opportunityType: deals.opportunityType,
      inHouseGross: deals.inHouseGross,
      sideA: sql<string | null>`(select string_agg(distinct co.name, ', ') from deal_parties dp join companies co on co.id = dp.company_id where dp.deal_id = "deals"."id" and dp.side = 'A')`,
      sideB: sql<string | null>`(select string_agg(distinct co.name, ', ') from deal_parties dp join companies co on co.id = dp.company_id where dp.deal_id = "deals"."id" and dp.side = 'B')`,
      cities: sql<string | null>`(select string_agg(distinct p.city, ', ') from deal_properties dp join properties p on p.id = dp.property_id where dp.deal_id = "deals"."id")`,
      states: sql<string | null>`(select string_agg(distinct p.state, ', ') from deal_properties dp join properties p on p.id = dp.property_id where dp.deal_id = "deals"."id")`,
      submarkets: sql<string | null>`(select string_agg(distinct s.name, ', ') from deal_properties dp join properties p on p.id = dp.property_id join submarkets s on s.id = p.submarket_id where dp.deal_id = "deals"."id")`,
      leadBrokers: sql<string | null>`(select string_agg(c.first_name || ' ' || c.last_name, ', ' order by c.last_name) from deal_team t join contacts c on c.id = t.contact_id where t.deal_id = "deals"."id" and t.is_lead_broker)`,
      team: sql<string | null>`(select string_agg(c.first_name || ' ' || c.last_name, ', ' order by c.last_name) from deal_team t join contacts c on c.id = t.contact_id where t.deal_id = "deals"."id")`,
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
        name: properties.name,
        address: properties.address,
        buildingDesignation: properties.buildingDesignation,
        city: properties.city,
        state: properties.state,
        buildingSf: properties.buildingSf,
        acreage: properties.acreage,
        addressVerified: properties.addressVerified,
        submarket: submarkets.name,
      })
      .from(dealProperties)
      .innerJoin(properties, eq(properties.id, dealProperties.propertyId))
      .leftJoin(submarkets, eq(submarkets.id, properties.submarketId))
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

type Editor = { id: string; isAdmin: boolean };

export async function createDeal(input: DealInput, by: Editor) {
  const [row] = await db
    .insert(deals)
    .values({
      ...prepare(input),
      furthestStage: furthestOf(input.furthestStage, input.stage),
      createdById: by.id,
      lastModifiedById: by.id,
    })
    .returning({ id: deals.id });
  return row.id;
}

export async function updateDeal(id: string, input: DealInput, by: Editor) {
  const [current] = await db.select({ stage: deals.stage, furthestStage: deals.furthestStage }).from(deals).where(eq(deals.id, id));
  // A typed correction counts unless the field is read-only (deal parked in Track, Dead or Lost);
  // either way it's never behind the stage being saved.
  const base = current && furthestStageLocked(current.stage, by) ? current.furthestStage : input.furthestStage;
  await db
    .update(deals)
    .set({
      ...prepare(input),
      furthestStage: furthestOf(base, input.stage),
      lastModifiedAt: new Date(),
      lastModifiedById: by.id,
    })
    .where(eq(deals.id, id));
}

/** Any change to a deal's properties, parties or team counts as modifying the deal. */
function touch(dealId: string, byId: string) {
  return db.update(deals).set({ lastModifiedAt: new Date(), lastModifiedById: byId }).where(eq(deals.id, dealId));
}

// ---- Properties on a deal ----

export async function addDealProperty(dealId: string, propertyId: string, byId: string) {
  await db.batch([
    db
      .insert(dealProperties)
      .values({ dealId, propertyId })
      .onConflictDoNothing({ target: [dealProperties.dealId, dealProperties.propertyId] }),
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

export async function removeTeamMember(dealId: string, teamId: string, byId: string) {
  await db.batch([
    db.delete(dealTeam).where(and(eq(dealTeam.id, teamId), eq(dealTeam.dealId, dealId))),
    touch(dealId, byId),
  ]);
}

export type TeamSelection = { teamIds: string[]; leadBrokerIds: string[]; leadAnalystId: string | null };

/**
 * Saves who is on the deal and who leads it, from the deal's Summary.
 * Keeps each existing member's roles; leads must be on the team.
 */
export async function syncTeam(dealId: string, sel: TeamSelection) {
  const team = [...new Set(sel.teamIds)];
  const brokers = sel.leadBrokerIds.filter((id) => team.includes(id));
  const analyst = sel.leadAnalystId && team.includes(sel.leadAnalystId) ? sel.leadAnalystId : null;

  const removeOthers = team.length
    ? db.delete(dealTeam).where(and(eq(dealTeam.dealId, dealId), notInArray(dealTeam.contactId, team)))
    : db.delete(dealTeam).where(eq(dealTeam.dealId, dealId));
  if (!team.length) {
    await removeOthers;
    return;
  }
  await db.batch([
    removeOthers,
    db
      .insert(dealTeam)
      .values(team.map((contactId) => ({ dealId, contactId })))
      .onConflictDoNothing({ target: [dealTeam.dealId, dealTeam.contactId] }),
    // Clear first so the one-lead-analyst rule is never briefly broken.
    db.update(dealTeam).set({ isLeadBroker: false, isLeadAnalyst: false }).where(eq(dealTeam.dealId, dealId)),
    ...(brokers.length
      ? [db.update(dealTeam).set({ isLeadBroker: true }).where(and(eq(dealTeam.dealId, dealId), inArray(dealTeam.contactId, brokers)))]
      : []),
    ...(analyst
      ? [db.update(dealTeam).set({ isLeadAnalyst: true }).where(and(eq(dealTeam.dealId, dealId), eq(dealTeam.contactId, analyst)))]
      : []),
  ]);
}

/** Turns one role on or off for one team member (Team tab). */
export async function toggleRole(dealId: string, teamId: string, role: TeamRole, byId: string) {
  await db.batch([
    db
      .update(dealTeam)
      .set({
        roles: sql`case when ${role}::team_role = any(${dealTeam.roles}) then array_remove(${dealTeam.roles}, ${role}::team_role) else array_append(${dealTeam.roles}, ${role}::team_role) end`,
      })
      .where(and(eq(dealTeam.id, teamId), eq(dealTeam.dealId, dealId))),
    touch(dealId, byId),
  ]);
}

// ---- Stage moves ----

export type StageMove = {
  stage: Stage;
  /** The stage's date (e.g. launch date), if one was given. Skipping leaves it as is. */
  date?: string | null;
  lostToCompanyId?: string | null;
  lostNote?: string | null;
  deadNote?: string | null;
};

/**
 * Moves a deal to any stage — forward, back or skipping. Never blocked by missing
 * data. Records the stage's date when given; winning the pitch (→ Engaged) marks it
 * Won, and a pitch that goes to Lost from BOV 1–2 is marked Lost.
 */
export async function moveStage(dealId: string, move: StageMove, byId: string) {
  const [current] = await db.select({ stage: deals.stage, furthestStage: deals.furthestStage }).from(deals).where(eq(deals.id, dealId));
  if (!current) return;
  const set: Partial<typeof deals.$inferInsert> = {
    stage: move.stage,
    furthestStage: furthestOf(current.furthestStage, move.stage),
    lastModifiedAt: new Date(),
    lastModifiedById: byId,
  };
  const dateField = STAGE_DATE[move.stage]?.field;
  if (dateField && move.date) set[dateField] = move.date;
  const fromPitch = current.stage === "BOV 1" || current.stage === "BOV 2";
  if (move.stage === "Engaged" && fromPitch) set.pitchStatus = "Won";
  if (move.stage === "Lost") {
    if (fromPitch) set.pitchStatus = "Lost";
    if (move.lostToCompanyId !== undefined) set.lostToCompanyId = move.lostToCompanyId;
    if (move.lostNote !== undefined) set.lostNote = move.lostNote;
  }
  if (move.stage === "Dead" && move.deadNote !== undefined) set.deadNote = move.deadNote;
  await db.update(deals).set(set).where(eq(deals.id, dealId));
}

// ---- Minimum info to close ----

/** What's still missing to close this deal, using saved data plus any unsaved overrides. */
export async function missingToClose(dealId: string, overrides: Partial<CloseCheckInput> = {}) {
  const [[d], props, [{ sideB }], [{ team }]] = await Promise.all([
    db.select().from(deals).where(eq(deals.id, dealId)),
    db
      .select({ address: properties.address, buildingSf: properties.buildingSf, acreage: properties.acreage })
      .from(dealProperties)
      .innerJoin(properties, eq(properties.id, dealProperties.propertyId))
      .where(eq(dealProperties.dealId, dealId)),
    db
      .select({ sideB: sql<number>`count(*)::int` })
      .from(dealParties)
      .where(and(eq(dealParties.dealId, dealId), eq(dealParties.side, "B"))),
    db.select({ team: sql<number>`count(*)::int` }).from(dealTeam).where(eq(dealTeam.dealId, dealId)),
  ]);
  if (!d) return [];
  return closeBlockers({
    dealType: d.dealType,
    dealSubtype: d.dealSubtype,
    reappsId: d.reappsId,
    opportunityType: d.opportunityType,
    represented: d.represented,
    closeDate: d.closeDate,
    closedPrice: d.closedPrice,
    totalCapitalization: d.totalCapitalization,
    loanAmount: d.loanAmount,
    totalLeaseConsideration: d.totalLeaseConsideration,
    totalCommission: d.totalCommission,
    properties: props,
    sideBCount: sideB,
    teamCount: team,
    ...overrides,
  });
}

export async function currentStage(dealId: string) {
  const [row] = await db.select({ stage: deals.stage }).from(deals).where(eq(deals.id, dealId));
  return row?.stage ?? null;
}
