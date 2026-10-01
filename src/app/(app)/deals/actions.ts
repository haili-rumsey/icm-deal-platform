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
  PITCH_STATUSES,
  REPRESENTED,
  SIDES,
  STAGES,
  TEAM_ROLES,
} from "@/domain/options";
import { closeBlockedMessage } from "@/domain/close-check";
import { bool, dec, ids, oneOf, str } from "@/lib/form";
import { createCompany } from "@/server/companies";
import {
  addDealParty,
  addDealProperty,
  assertCanEdit,
  createDeal,
  currentStage,
  DealLockedError,
  missingToClose,
  moveStage,
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

    stage: oneOf(fd, "stage", STAGES) ?? "BOV 1",
    pitchDate: str(fd, "pitchDate"),
    pitchStatus: oneOf(fd, "pitchStatus", PITCH_STATUSES),
    lostToCompanyId: str(fd, "lostToCompanyId"),
    lostNote: str(fd, "lostNote"),
    wonDate: str(fd, "wonDate"),
    launchDate: str(fd, "launchDate"),
    callForOffersDate: str(fd, "callForOffersDate"),
    awardedDate: str(fd, "awardedDate"),
    ddExpirationDate: str(fd, "ddExpirationDate"),
    closeDate: str(fd, "closeDate"),

    bovPriceLow: dec(fd, "bovPriceLow"),
    bovPriceMid: dec(fd, "bovPriceMid"),
    bovPriceHigh: dec(fd, "bovPriceHigh"),
    bovYear1Cap: dec(fd, "bovYear1Cap"),
    bovUlirr: dec(fd, "bovUlirr"),
    bovLirr: dec(fd, "bovLirr"),
    bovExitCap: dec(fd, "bovExitCap"),
    bovHoldYears: dec(fd, "bovHoldYears"),
    guidancePrice: dec(fd, "guidancePrice"),
    omYear1Cap: dec(fd, "omYear1Cap"),
    omUlirr: dec(fd, "omUlirr"),
    omLirr: dec(fd, "omLirr"),
    omExitCap: dec(fd, "omExitCap"),
    omHoldYears: dec(fd, "omHoldYears"),
    contractPrice: dec(fd, "contractPrice"),
    closedPrice: dec(fd, "closedPrice"),
    closedYear1Cap: dec(fd, "closedYear1Cap"),
    closedUlirr: dec(fd, "closedUlirr"),
    closedLirr: dec(fd, "closedLirr"),
    closedExitCap: dec(fd, "closedExitCap"),
    closedHoldYears: dec(fd, "closedHoldYears"),
    priceNotes: str(fd, "priceNotes"),

    totalCapitalization: dec(fd, "totalCapitalization"),
    loanAmount: dec(fd, "loanAmount"),
    interestRate: dec(fd, "interestRate"),
    loanTermYears: dec(fd, "loanTermYears"),
    ltv: dec(fd, "ltv"),
    totalLeaseConsideration: dec(fd, "totalLeaseConsideration"),

    totalCommission: dec(fd, "totalCommission"),
    outsideCommission: dec(fd, "outsideCommission"),
    outsideCommissionNote: str(fd, "outsideCommissionNote"),
    inHouseGross: dec(fd, "inHouseGross"),
    inHouseGrossManual: bool(fd, "inHouseGrossManual"),
    feeRate: dec(fd, "feeRate"),
    feeNotes: str(fd, "feeNotes"),
  };
}

/** Every change to a deal goes through this: closed deals are admin-only. */
async function editor(dealId: string) {
  const user = await requireUser();
  await assertCanEdit(dealId, user);
  return user;
}

export async function saveDeal(id: string | null, _prev: SaveState, fd: FormData): Promise<SaveState> {
  const user = await requireUser();
  const input = parse(fd);
  if (typeof input === "string") return { ok: false, message: input };
  const team = { teamIds: ids(fd, "teamIds"), leadBrokerIds: ids(fd, "leadBrokerIds"), leadAnalystId: str(fd, "leadAnalystId") };
  if (!id && input.stage === "Closed") {
    // Properties and parties are added after the first save, so a new deal can't meet
    // the minimum to close yet.
    return {
      ok: false,
      message: "A new deal can't start at Closed. Save it at Under Contract, add its property and buyer side, then move it to Closed.",
    };
  }
  if (id && input.stage === "Closed" && (await currentStage(id)) !== "Closed") {
    // Moving into Closed: check what's being saved now, plus the deal's properties and parties.
    const missing = await missingToClose(id, { ...input, teamCount: team.teamIds.length });
    if (missing.length) return { ok: false, message: closeBlockedMessage(missing) };
  }
  if (!id) {
    const newId = await createDeal(input, user.id);
    await syncTeam(newId, team);
    revalidatePath("/deals");
    redirect(`/deals/${newId}`);
  }
  try {
    await assertCanEdit(id, user);
  } catch (e) {
    if (e instanceof DealLockedError) return { ok: false, message: e.message };
    throw e;
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
  const user = await editor(dealId);
  const propertyId = str(fd, "propertyId");
  if (!propertyId) return;
  await addDealProperty(dealId, propertyId, user.id);
  refresh(dealId);
  // Drop the ?addProperty= hint once it's been used.
  redirect(`/deals/${dealId}`);
}

export async function removePropertyAction(dealId: string, propertyId: string) {
  const user = await editor(dealId);
  await removeDealProperty(dealId, propertyId, user.id);
  refresh(dealId);
}

export async function addPartyAction(dealId: string, fd: FormData) {
  const user = await editor(dealId);
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
  const user = await editor(dealId);
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
  const user = await editor(dealId);
  await removeDealParty(dealId, partyId, user.id);
  refresh(dealId);
}

export async function toggleRoleAction(dealId: string, teamId: string, role: string) {
  const user = await editor(dealId);
  const valid = TEAM_ROLES.find((r) => r === role);
  if (!valid) return;
  await toggleRole(dealId, teamId, valid, user.id);
  refresh(dealId);
}

export async function removeTeamAction(dealId: string, teamId: string) {
  const user = await editor(dealId);
  await removeTeamMember(dealId, teamId, user.id);
  refresh(dealId);
}

export type StageState = { message: string } | null;

/** Stage bar: move to any stage, with the stage's date and (for a lost pitch) who won it. */
export async function moveStageAction(dealId: string, _prev: StageState, fd: FormData): Promise<StageState> {
  let user;
  try {
    user = await editor(dealId);
  } catch (e) {
    if (e instanceof DealLockedError) return { message: e.message };
    throw e;
  }
  const stage = oneOf(fd, "stage", STAGES);
  if (!stage) return { message: "Pick a stage." };
  const date = fd.has("skipDate") ? null : str(fd, "date");
  if (stage === "Closed" && (await currentStage(dealId)) !== "Closed") {
    const missing = await missingToClose(dealId, date ? { closeDate: date } : {});
    if (missing.length) return { message: closeBlockedMessage(missing) };
  }
  await moveStage(
    dealId,
    {
      stage,
      date,
      lostToCompanyId: fd.has("lostToCompanyId") ? str(fd, "lostToCompanyId") : undefined,
      lostNote: fd.has("lostNote") ? str(fd, "lostNote") : undefined,
    },
    user.id,
  );
  refresh(dealId);
  return null;
}
