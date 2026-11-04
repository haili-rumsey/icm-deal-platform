import "server-only";
import { and, asc, eq, isNull, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { dealLinks, dealParties, dealProperties, deals, dealTeam, properties } from "@/db/schema";
import { furthestOf } from "@/domain/stages";

/**
 * Break out / Combine (Haili, approved 2026-10-14 for after 1.6 sign-off).
 *
 * Break out: one property leaves a portfolio deal for a new deal of its own. The new deal
 * copies the seller (side A), deal team, type, stage and dates — not prices, since portfolio
 * pricing doesn't apply to one building. The two deals are linked both ways.
 *
 * Combine: the user picks which of two deals stays. The other's properties, parties and team
 * move onto it (the staying deal's prices are kept). The other is archived — off every list and
 * report, never deleted — with "Combined into …" added to its Deal notes, and the two are linked.
 *
 * Closed deals can't be broken out or combined: a closed record is accounting's.
 */

export class DealLinkError extends Error {}

const today = () => new Date().toLocaleDateString("en-US", { timeZone: "America/Chicago" });

export async function breakOutProperty(dealId: string, propertyId: string, byId: string): Promise<string> {
  const [[d], [p], props, parties, team] = await Promise.all([
    db.select().from(deals).where(eq(deals.id, dealId)),
    db
      .select({ name: properties.name, address: properties.address, buildingDesignation: properties.buildingDesignation })
      .from(properties)
      .where(eq(properties.id, propertyId)),
    db.select({ id: dealProperties.propertyId }).from(dealProperties).where(eq(dealProperties.dealId, dealId)),
    db.select().from(dealParties).where(and(eq(dealParties.dealId, dealId), eq(dealParties.side, "A"))),
    db.select().from(dealTeam).where(eq(dealTeam.dealId, dealId)),
  ]);
  if (!d || !p) throw new DealLinkError("That deal or property no longer exists.");
  if (d.stage === "Closed") throw new DealLinkError("A closed deal can't be broken out.");
  if (!props.some((x) => x.id === propertyId)) throw new DealLinkError("That property isn't on this deal.");
  if (props.length < 2) throw new DealLinkError("This deal has only one property, so there's nothing to break out.");

  const label = p.name || [p.address, p.buildingDesignation].filter(Boolean).join(", ") || "property";
  const newId = crypto.randomUUID();
  const now = new Date();

  await db.batch([
    db.insert(deals).values({
      id: newId,
      dealName: `${d.dealName} – ${label}`,
      category: d.category,
      dealType: d.dealType,
      dealSubtype: d.dealSubtype,
      opportunityType: d.opportunityType,
      represented: d.represented,
      isIos: d.isIos,
      directAward: d.directAward,
      referralContactId: d.referralContactId,
      closingNotes: `Broken out of "${d.dealName}" on ${today()}.`,
      stage: d.stage,
      furthestStage: furthestOf(d.furthestStage, d.stage),
      pitchDueDate: d.pitchDueDate,
      pitchDate: d.pitchDate,
      pitchStatus: d.pitchStatus,
      wonDate: d.wonDate,
      launchDate: d.launchDate,
      callForOffersDate: d.callForOffersDate,
      awardedDate: d.awardedDate,
      ddExpirationDate: d.ddExpirationDate,
      closeDate: d.closeDate,
      followUpDate: d.followUpDate,
      createdById: byId,
      lastModifiedById: byId,
    }),
    db.insert(dealProperties).values({ dealId: newId, propertyId }),
    db.delete(dealProperties).where(and(eq(dealProperties.dealId, dealId), eq(dealProperties.propertyId, propertyId))),
    ...(parties.length
      ? [db.insert(dealParties).values(parties.map((x) => ({ dealId: newId, side: x.side, companyId: x.companyId, contactId: x.contactId })))]
      : []),
    ...(team.length
      ? [
          db.insert(dealTeam).values(
            team.map((t) => ({
              dealId: newId,
              contactId: t.contactId,
              roles: t.roles,
              isLeadBroker: t.isLeadBroker,
              isLeadAnalyst: t.isLeadAnalyst,
            })),
          ),
        ]
      : []),
    db.insert(dealLinks).values({ kind: "Broken out", fromDealId: dealId, toDealId: newId, createdById: byId }),
    db.update(deals).set({ lastModifiedAt: now, lastModifiedById: byId }).where(eq(deals.id, dealId)),
  ]);
  return newId;
}

export async function combineDeals(intoId: string, otherId: string, byId: string) {
  if (intoId === otherId) throw new DealLinkError("Pick a different deal to combine with.");
  const [[into], [other], otherProps, intoParties, otherParties, intoTeam, otherTeam] = await Promise.all([
    db.select({ id: deals.id, name: deals.dealName, stage: deals.stage }).from(deals).where(eq(deals.id, intoId)),
    db.select({ id: deals.id, stage: deals.stage, notes: deals.closingNotes }).from(deals).where(eq(deals.id, otherId)),
    db.select({ id: dealProperties.propertyId }).from(dealProperties).where(eq(dealProperties.dealId, otherId)),
    db.select().from(dealParties).where(eq(dealParties.dealId, intoId)),
    db.select().from(dealParties).where(eq(dealParties.dealId, otherId)),
    db.select().from(dealTeam).where(eq(dealTeam.dealId, intoId)),
    db.select().from(dealTeam).where(eq(dealTeam.dealId, otherId)),
  ]);
  if (!into || !other) throw new DealLinkError("That deal no longer exists.");
  if (into.stage === "Closed" || other.stage === "Closed") throw new DealLinkError("Closed deals can't be combined.");

  // Parties: skip any that are already on this deal (same side, company and contact).
  const key = (x: { side: string; companyId: string; contactId: string | null }) => `${x.side}|${x.companyId}|${x.contactId ?? ""}`;
  const haveParty = new Set(intoParties.map(key));
  const newParties = otherParties.filter((x) => !haveParty.has(key(x)));

  // Team: people already on this deal keep their row; newcomers bring their roles. This deal's
  // lead analyst stays — the other deal's only takes over if this one has none.
  const onTeam = new Set(intoTeam.map((t) => t.contactId));
  const hasAnalyst = intoTeam.some((t) => t.isLeadAnalyst);
  const newTeam = otherTeam
    .filter((t) => !onTeam.has(t.contactId))
    .map((t) => ({
      dealId: intoId,
      contactId: t.contactId,
      roles: t.roles,
      isLeadBroker: t.isLeadBroker,
      isLeadAnalyst: t.isLeadAnalyst && !hasAnalyst,
    }));

  const now = new Date();
  // One atomic batch: either everything moves or nothing does.
  await db.batch([
    db.delete(dealProperties).where(eq(dealProperties.dealId, otherId)),
    ...(otherProps.length
      ? [
          db
            .insert(dealProperties)
            .values(otherProps.map((x) => ({ dealId: intoId, propertyId: x.id })))
            .onConflictDoNothing({ target: [dealProperties.dealId, dealProperties.propertyId] }),
        ]
      : []),
    ...(newParties.length
      ? [db.insert(dealParties).values(newParties.map((x) => ({ dealId: intoId, side: x.side, companyId: x.companyId, contactId: x.contactId })))]
      : []),
    db.delete(dealParties).where(eq(dealParties.dealId, otherId)),
    // Clear the other deal's team first so the move never trips the one-lead-analyst rule.
    db.delete(dealTeam).where(eq(dealTeam.dealId, otherId)),
    ...(newTeam.length ? [db.insert(dealTeam).values(newTeam)] : []),
    // Archived, not Dead (Haili, 2026-11-04): a merged duplicate isn't a deal that died, so it
    // must not count in any list or report. Its stage is left as it was.
    db
      .update(deals)
      .set({
        archivedAt: now,
        closingNotes: [other.notes, `Combined into "${into.name}" on ${today()}.`].filter(Boolean).join("\n"),
        lastModifiedAt: now,
        lastModifiedById: byId,
      })
      .where(eq(deals.id, otherId)),
    db.insert(dealLinks).values({ kind: "Combined", fromDealId: otherId, toDealId: intoId, createdById: byId }),
    db.update(deals).set({ lastModifiedAt: now, lastModifiedById: byId }).where(eq(deals.id, intoId)),
  ]);
}

const linkedDeal = alias(deals, "linked_deal");

export type RelatedDeal = { linkId: string; dealId: string; dealName: string; stage: string; label: string };

/** Every deal linked to this one, with how it's related, oldest link first. */
export async function relatedDeals(dealId: string): Promise<RelatedDeal[]> {
  const rows = await db
    .select({
      linkId: dealLinks.id,
      kind: dealLinks.kind,
      fromDealId: dealLinks.fromDealId,
      createdAt: dealLinks.createdAt,
      dealId: linkedDeal.id,
      dealName: linkedDeal.dealName,
      stage: linkedDeal.stage,
    })
    .from(dealLinks)
    .innerJoin(
      linkedDeal,
      or(
        and(eq(dealLinks.fromDealId, dealId), eq(linkedDeal.id, dealLinks.toDealId)),
        and(eq(dealLinks.toDealId, dealId), eq(linkedDeal.id, dealLinks.fromDealId)),
      ),
    )
    .where(or(eq(dealLinks.fromDealId, dealId), eq(dealLinks.toDealId, dealId)))
    .orderBy(asc(dealLinks.createdAt));

  return rows.map((r) => {
    const outgoing = r.fromDealId === dealId;
    const label =
      r.kind === "Broken out"
        ? outgoing
          ? "Property broken out into"
          : "Broken out of"
        : outgoing
          ? "Combined into"
          : "Combined into this deal";
    return { linkId: r.linkId, dealId: r.dealId, dealName: r.dealName, stage: r.stage, label };
  });
}

/** Deals that can be combined into this one: any other deal that isn't closed or archived. */
export async function combineOptions(dealId: string) {
  const rows = await db
    .select({ id: deals.id, name: deals.dealName, stage: deals.stage })
    .from(deals)
    .where(and(ne(deals.id, dealId), ne(deals.stage, "Closed"), isNull(deals.archivedAt)))
    .orderBy(asc(deals.dealName));
  return rows.map((r) => ({ id: r.id, name: r.name, hint: r.stage }));
}
