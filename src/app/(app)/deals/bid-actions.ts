"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth";
import { BID_ROUNDS } from "@/domain/options";
import { bool, dec, int, oneOf, str } from "@/lib/form";
import { assertCanEdit } from "@/server/deals";
import { awardBid, createBid, deleteBid, markFellOut, unawardBid, updateBid, type AwardResult, type BidInput } from "@/server/bids";
import { contactIdForEmail, icmTeamOptions } from "@/server/contacts";

export type BidFormState = { message: string | null; saved?: number };

async function editor(dealId: string) {
  const user = await requireUser();
  await assertCanEdit(dealId, user);
  return user;
}

function refresh(dealId: string) {
  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/search");
}

function parse(fd: FormData): BidInput | string {
  const companyId = str(fd, "companyId");
  if (!companyId) return "Pick the bidder's company.";
  return {
    companyId,
    contactId: str(fd, "contactId"),
    bidRound: oneOf(fd, "bidRound", BID_ROUNDS),
    bidAmount: dec(fd, "bidAmount"),
    bidDate: str(fd, "bidDate"),
    isVerbal: bool(fd, "isVerbal"),
    toured: bool(fd, "toured"),
    ddPeriodDays: int(fd, "ddPeriodDays"),
    closingPeriodDays: int(fd, "closingPeriodDays"),
    initialEm: dec(fd, "initialEm"),
    additionalEm: dec(fd, "additionalEm"),
    debtNotes: str(fd, "debtNotes"),
    notes: str(fd, "notes"),
  };
}

/** Adds a bid (bidId null) or saves changes to one. */
export async function saveBidAction(dealId: string, bidId: string | null, prev: BidFormState, fd: FormData): Promise<BidFormState> {
  const user = await editor(dealId);
  const input = parse(fd);
  if (typeof input === "string") return { message: input, saved: prev.saved };
  if (bidId) await updateBid(dealId, bidId, input, user.id);
  else await createBid(dealId, input, user.id);
  refresh(dealId);
  return { message: null, saved: (prev.saved ?? 0) + 1 };
}

export async function deleteBidAction(dealId: string, bidId: string) {
  const user = await editor(dealId);
  await deleteBid(dealId, bidId, user.id);
  refresh(dealId);
}

export async function awardBidAction(dealId: string, bidId: string, price: "ask" | "replace" | "keep"): Promise<AwardResult> {
  const user = await editor(dealId);
  const result = await awardBid(dealId, bidId, price === "replace" || price === "keep" ? price : "ask", user.id);
  if (result.ok) {
    refresh(dealId);
    revalidatePath("/reports", "layout");
  }
  return result;
}

/** Marks the awarded bid fell out. The note is required (PRD §1 Bid). */
export async function fellOutAction(dealId: string, bidId: string, _prev: BidFormState, fd: FormData): Promise<BidFormState> {
  const user = await editor(dealId);
  const note = str(fd, "fellOutNote");
  if (!note) return { message: "A note is required when a bid falls out — say what happened." };
  const contactId = await contactIdForEmail(user.email);
  const roster = contactId ? await icmTeamOptions() : [];
  await markFellOut(dealId, bidId, str(fd, "fellOutDate"), note, {
    userId: user.id,
    authorContactId: contactId && roster.some((r) => r.id === contactId) ? contactId : null,
  });
  refresh(dealId);
  revalidatePath("/reports", "layout");
  revalidatePath("/notes");
  return { message: null, saved: 1 };
}

export async function unawardBidAction(dealId: string, bidId: string) {
  const user = await editor(dealId);
  await unawardBid(dealId, bidId, user.id);
  refresh(dealId);
}
