"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import type { SaveState } from "@/components/record-form";
import {
  CATEGORIES,
  DEAL_SUBTYPES,
  DEAL_TYPES,
  OPPORTUNITY_TYPES,
  REPRESENTED,
  SIDES,
  TEAM_ROLES,
} from "@/domain/options";
import { bool, dec, manyOf, oneOf, str } from "@/lib/form";
import {
  addDealParty,
  addDealProperty,
  createDeal,
  removeDealParty,
  removeDealProperty,
  removeTeamMember,
  saveTeamMember,
  updateDeal,
  type DealInput,
} from "@/server/deals";

function parse(fd: FormData): DealInput | string {
  const dealName = str(fd, "dealName");
  if (!dealName) return "Give the deal a name (convention: Client Name-Deal Name).";
  return {
    dealName,
    reappsId: str(fd, "reappsId"),
    category: oneOf(fd, "category", CATEGORIES),
    dealType: oneOf(fd, "dealType", DEAL_TYPES),
    dealSubtype: oneOf(fd, "dealSubtype", DEAL_SUBTYPES),
    opportunityType: oneOf(fd, "opportunityType", OPPORTUNITY_TYPES),
    represented: oneOf(fd, "represented", REPRESENTED),
    isIos: bool(fd, "isIos"),
    directAward: bool(fd, "directAward"),
    waltYears: dec(fd, "waltYears"),
    waltAsOf: str(fd, "waltAsOf"),
    referralContactId: str(fd, "referralContactId"),
    closingNotes: str(fd, "closingNotes"),
  };
}

export async function saveDeal(id: string | null, _prev: SaveState, fd: FormData): Promise<SaveState> {
  const user = await requireUser();
  const input = parse(fd);
  if (typeof input === "string") return { ok: false, message: input };
  if (!id) {
    const newId = await createDeal(input, user.id);
    revalidatePath("/deals");
    redirect(`/deals/${newId}`);
  }
  await updateDeal(id, input, user.id);
  revalidatePath("/deals", "layout");
  return { ok: true, message: "Saved." };
}

function refresh(dealId: string) {
  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/deals");
}

export async function addPropertyAction(dealId: string, fd: FormData) {
  const user = await requireUser();
  const propertyId = str(fd, "propertyId");
  if (!propertyId) return;
  await addDealProperty(dealId, propertyId, dec(fd, "allocatedPrice"), user.id);
  refresh(dealId);
  // Drop the ?addProperty= hint once it's been used.
  redirect(`/deals/${dealId}`);
}

export async function removePropertyAction(dealId: string, propertyId: string) {
  const user = await requireUser();
  await removeDealProperty(dealId, propertyId, user.id);
  refresh(dealId);
}

export async function addPartyAction(dealId: string, fd: FormData) {
  const user = await requireUser();
  const side = oneOf(fd, "side", SIDES);
  const companyId = str(fd, "companyId");
  if (!side || !companyId) return;
  await addDealParty(dealId, side, companyId, str(fd, "contactId"), user.id);
  refresh(dealId);
}

export async function removePartyAction(dealId: string, partyId: string) {
  const user = await requireUser();
  await removeDealParty(dealId, partyId, user.id);
  refresh(dealId);
}

export async function saveTeamAction(dealId: string, fd: FormData) {
  const user = await requireUser();
  const contactId = str(fd, "contactId");
  if (!contactId) return;
  await saveTeamMember(
    dealId,
    {
      contactId,
      roles: manyOf(fd, "roles", TEAM_ROLES),
      isLeadBroker: bool(fd, "isLeadBroker"),
      isLeadAnalyst: bool(fd, "isLeadAnalyst"),
    },
    user.id,
  );
  refresh(dealId);
}

export async function removeTeamAction(dealId: string, teamId: string) {
  const user = await requireUser();
  await removeTeamMember(dealId, teamId, user.id);
  refresh(dealId);
}
