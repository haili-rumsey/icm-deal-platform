import "server-only";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { bids, companies, contacts, dealParties, deals, notes } from "@/db/schema";
import type { BidRound } from "@/domain/options";

/**
 * Bids (milestone 2.1). One row per bidder per round, attached to the company. Awarding a bid
 * marks the buyer: it becomes the deal's only awarded bid, its company (and contact) is added
 * to side B if not already there, and the deal's sale price fills from the bid amount when the
 * sale price is blank — replacing an existing price only when the person confirms it (Haili,
 * 2026-11-09). Fell-out handling comes with 2.2.
 */

export type BidInput = {
  companyId: string;
  contactId: string | null;
  bidRound: BidRound | null;
  bidAmount: string | null;
  bidDate: string | null;
  isVerbal: boolean;
  toured: boolean;
  ddPeriodDays: number | null;
  closingPeriodDays: number | null;
  initialEm: string | null;
  additionalEm: string | null;
  debtNotes: string | null;
  notes: string | null;
};

export type BidRow = Awaited<ReturnType<typeof listBids>>[number];

export async function listBids(dealId: string) {
  return db
    .select({
      id: bids.id,
      companyId: bids.companyId,
      companyName: companies.name,
      contactId: bids.contactId,
      contactName: sql<string | null>`${contacts.firstName} || ' ' || ${contacts.lastName}`,
      bidRound: bids.bidRound,
      bidAmount: bids.bidAmount,
      bidDate: bids.bidDate,
      isVerbal: bids.isVerbal,
      toured: bids.toured,
      isAwarded: bids.isAwarded,
      fellOut: bids.fellOut,
      fellOutDate: bids.fellOutDate,
      fellOutNote: bids.fellOutNote,
      ddPeriodDays: bids.ddPeriodDays,
      closingPeriodDays: bids.closingPeriodDays,
      initialEm: bids.initialEm,
      additionalEm: bids.additionalEm,
      debtNotes: bids.debtNotes,
      notes: bids.notes,
    })
    .from(bids)
    .innerJoin(companies, eq(companies.id, bids.companyId))
    .leftJoin(contacts, eq(contacts.id, bids.contactId))
    .where(eq(bids.dealId, dealId))
    .orderBy(asc(companies.name), asc(bids.bidRound));
}

const touch = (dealId: string, byId: string) =>
  db.update(deals).set({ lastModifiedAt: new Date(), lastModifiedById: byId }).where(eq(deals.id, dealId));

export async function createBid(dealId: string, input: BidInput, byId: string) {
  await db.batch([db.insert(bids).values({ ...input, dealId, createdById: byId, lastModifiedById: byId }), touch(dealId, byId)]);
}

export async function updateBid(dealId: string, bidId: string, input: BidInput, byId: string) {
  await db.batch([
    db
      .update(bids)
      .set({ ...input, lastModifiedAt: new Date(), lastModifiedById: byId })
      .where(and(eq(bids.id, bidId), eq(bids.dealId, dealId))),
    touch(dealId, byId),
  ]);
}

export async function deleteBid(dealId: string, bidId: string, byId: string) {
  await db.batch([db.delete(bids).where(and(eq(bids.id, bidId), eq(bids.dealId, dealId))), touch(dealId, byId)]);
}

export type AwardResult =
  /** Done. */
  | { ok: true }
  /** The deal already has a different sale price: ask before replacing it. */
  | { ok: false; confirmPrice: { current: string; bid: string } };

/**
 * Marks one bid as the winner. `price` decides an existing, different sale price: "ask" stops
 * and asks, "replace" overwrites it with the bid amount, "keep" leaves it. A blank sale price
 * is always filled from the bid.
 */
export async function awardBid(dealId: string, bidId: string, price: "ask" | "replace" | "keep", byId: string): Promise<AwardResult> {
  const [[bid], [deal], sideB] = await Promise.all([
    db.select().from(bids).where(and(eq(bids.id, bidId), eq(bids.dealId, dealId))),
    db.select({ closedPrice: deals.closedPrice }).from(deals).where(eq(deals.id, dealId)),
    db.select().from(dealParties).where(and(eq(dealParties.dealId, dealId), eq(dealParties.side, "B"))),
  ]);
  if (!bid || !deal || bid.fellOut) return { ok: true };

  const current = deal.closedPrice;
  const differs = current !== null && bid.bidAmount !== null && Number(current) !== Number(bid.bidAmount);
  if (differs && price === "ask") return { ok: false, confirmPrice: { current, bid: bid.bidAmount! } };
  const setPrice = bid.bidAmount !== null && (current === null || price === "replace");

  // Side B is seeded from the awarded bid and stays editable (PRD §1 Deal Party).
  const onSideB = sideB.some((p) => p.companyId === bid.companyId && (p.contactId ?? null) === (bid.contactId ?? null));
  const now = new Date();

  await db.batch([
    // Clear first so the one-awarded-bid rule is never briefly broken. Fell-out bids keep their
    // award so the history shows who won first.
    db
      .update(bids)
      .set({ isAwarded: false })
      .where(and(eq(bids.dealId, dealId), ne(bids.id, bidId), eq(bids.fellOut, false))),
    db.update(bids).set({ isAwarded: true, lastModifiedAt: now, lastModifiedById: byId }).where(eq(bids.id, bidId)),
    ...(onSideB ? [] : [db.insert(dealParties).values({ dealId, side: "B", companyId: bid.companyId, contactId: bid.contactId })]),
    db
      .update(deals)
      .set({ ...(setPrice ? { closedPrice: bid.bidAmount } : {}), lastModifiedAt: now, lastModifiedById: byId })
      .where(eq(deals.id, dealId)),
  ]);
  return { ok: true };
}

/**
 * An awarded bid that fell out before closing (2.2, Haili 2026-11-10). The bid stays awarded and
 * is marked fell out with its date and required note; its company is taken off the buyer side;
 * the deal goes back to Marketing; and the note is logged on the bidder's company, tagged to the
 * deal. Another bid can then be awarded without erasing this one.
 */
export async function markFellOut(
  dealId: string,
  bidId: string,
  fellOutDate: string | null,
  note: string,
  by: { userId: string; authorContactId: string | null },
) {
  const [bid] = await db.select().from(bids).where(and(eq(bids.id, bidId), eq(bids.dealId, dealId)));
  if (!bid || !bid.isAwarded || bid.fellOut) return;
  const now = new Date();
  const when = fellOutDate ?? now.toISOString().slice(0, 10);
  const [y, m, d] = when.split("-");
  await db.batch([
    db
      .update(bids)
      .set({ fellOut: true, fellOutDate: when, fellOutNote: note, lastModifiedAt: now, lastModifiedById: by.userId })
      .where(eq(bids.id, bidId)),
    db.delete(dealParties).where(and(eq(dealParties.dealId, dealId), eq(dealParties.side, "B"), eq(dealParties.companyId, bid.companyId))),
    db.update(deals).set({ stage: "Marketing", lastModifiedAt: now, lastModifiedById: by.userId }).where(eq(deals.id, dealId)),
    db.insert(notes).values({
      companyId: bid.companyId,
      dealId,
      contactId: bid.contactId,
      authorId: by.authorContactId,
      enteredById: by.userId,
      source: "Internal",
      body: `Awarded bid fell out (${Number(m)}/${Number(d)}/${y}): ${note}`,
      createdById: by.userId,
      lastModifiedById: by.userId,
    }),
  ]);
}

/** Takes the award off a bid. The buyer on side B and the sale price are left as they are. */
export async function unawardBid(dealId: string, bidId: string, byId: string) {
  await db.batch([
    db
      .update(bids)
      .set({ isAwarded: false, lastModifiedAt: new Date(), lastModifiedById: byId })
      .where(and(eq(bids.id, bidId), eq(bids.dealId, dealId))),
    touch(dealId, byId),
  ]);
}
