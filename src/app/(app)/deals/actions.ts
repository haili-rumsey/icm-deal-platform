"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import type { SaveState } from "@/components/record-page";
import {
  CATEGORIES,
  DEAL_SUBTYPES,
  DEAL_TYPES,
  OPPORTUNITY_TYPES,
  REPRESENTED,
  SIDES,
  TEAM_ROLES,
} from "@/domain/options";
import { bool, dec, ids, oneOf, str } from "@/lib/form";
import { createCompany } from "@/server/companies";
import {
  addDealParty,
  addDealProperty,
  createDeal,
  removeDealParty,
  removeDealProperty,
  removeTeamMember,
  syncTeam,
  toggleRole,
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
    referralContactId: str(fd, "referralContactId"),
    closingNotes: str(fd, "closingNotes"),
  };
}

export async function saveDeal(id: string | null, _prev: SaveState, fd: FormData): Promise<SaveState> {
  const user = await requireUser();
  const input = parse(fd);
  if (typeof input === "string") return { ok: false, message: input };
  const team = { teamIds: ids(fd, "teamIds"), leadBrokerIds: ids(fd, "leadBrokerIds"), leadAnalystId: str(fd, "leadAnalystId") };
  if (!id) {
    const newId = await createDeal(input, user.id);
    await syncTeam(newId, team);
    revalidatePath("/deals");
    redirect(`/deals/${newId}`);
  }
  await updateDeal(id, input, user.id);
  await syncTeam(id, team);
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

export type QuickCompanyState = { message: string } | null;

/** Parties tab: the company isn't in the system yet — create it and add it to the side in one step. */
export async function createPartyCompanyAction(
  dealId: string,
  _prev: QuickCompanyState,
  fd: FormData,
): Promise<QuickCompanyState> {
  const user = await requireUser();
  const side = oneOf(fd, "side", SIDES);
  const name = str(fd, "name");
  const website = str(fd, "website");
  const noWebsite = bool(fd, "noWebsite");
  if (!side) return { message: "Something went wrong — pick a side again." };
  if (!name) return { message: "Enter the company name." };
  if (!website && !noWebsite) return { message: "Enter a website, or tick “No website”." };
  const companyId = await createCompany(
    { name, website, noWebsite, types: [], investmentStrategies: [], notes: null },
    user.id,
  );
  await addDealParty(dealId, side, companyId, null, user.id);
  refresh(dealId);
  revalidatePath("/companies");
  return null;
}

export async function removePartyAction(dealId: string, partyId: string) {
  const user = await requireUser();
  await removeDealParty(dealId, partyId, user.id);
  refresh(dealId);
}

export async function toggleRoleAction(dealId: string, teamId: string, role: string) {
  const user = await requireUser();
  const valid = TEAM_ROLES.find((r) => r === role);
  if (!valid) return;
  await toggleRole(dealId, teamId, valid, user.id);
  refresh(dealId);
}

export async function removeTeamAction(dealId: string, teamId: string) {
  const user = await requireUser();
  await removeTeamMember(dealId, teamId, user.id);
  refresh(dealId);
}
