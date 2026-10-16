"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
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
  type Stage,
} from "@/domain/options";
import { closeBlockedMessage, needsDealTabs } from "@/domain/close-check";
import { FEE_STAGES, PIPELINE_KEY_DATE, stagePriceField, type KeyDateField, type PriceField } from "@/domain/stages";
import { icmTeamOptions } from "@/server/contacts";
import type { CloseInfo } from "./[id]/close-dialog";
import { bool, dec, ids, oneOf, str } from "@/lib/form";
import { db } from "@/db";
import { setOwnersForDeal } from "@/server/property-owners";
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
  saveCloseFields,
  getDeal,
  isLockedFor,
  quickUpdateDeal,
  setLeadAnalyst,
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
    furthestStage: oneOf(fd, "furthestStage", STAGES),
    pitchDueDate: str(fd, "pitchDueDate"),
    pitchDate: str(fd, "pitchDate"),
    pitchStatus: oneOf(fd, "pitchStatus", PITCH_STATUSES),
    lostToCompanyId: str(fd, "lostToCompanyId"),
    lostNote: str(fd, "lostNote"),
    deadNote: str(fd, "deadNote"),
    wonDate: str(fd, "wonDate"),
    launchDate: str(fd, "launchDate"),
    callForOffersDate: str(fd, "callForOffersDate"),
    awardedDate: str(fd, "awardedDate"),
    ddExpirationDate: str(fd, "ddExpirationDate"),
    closeDate: str(fd, "closeDate"),
    followUpDate: str(fd, "followUpDate"),

    bovPriceLow: dec(fd, "bovPriceLow"),
    bovPriceMid: dec(fd, "bovPriceMid"),
    bovPriceHigh: dec(fd, "bovPriceHigh"),
    bovYear1Cap: dec(fd, "bovYear1Cap"),
    // ULIRR, LIRR, exit cap and hold period are no longer tracked (Haili, 1.6); columns to be dropped.
    bovUlirr: null,
    bovLirr: null,
    bovExitCap: null,
    bovHoldYears: null,
    guidancePrice: dec(fd, "guidancePrice"),
    omYear1Cap: dec(fd, "omYear1Cap"),
    omUlirr: null,
    omLirr: null,
    omExitCap: null,
    omHoldYears: null,
    closedPrice: dec(fd, "closedPrice"),
    closedYear1Cap: dec(fd, "closedYear1Cap"),
    closedUlirr: null,
    closedLirr: null,
    closedExitCap: null,
    closedHoldYears: null,
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
  const current = id ? await currentStage(id) : null;
  let closing = !!id && input.stage === "Closed" && current !== "Closed";
  let blocked: string | null = null;
  if (id && closing) {
    // Moving into Closed: check what's being saved now, plus the deal's properties and parties.
    const missing = await missingToClose(id, {
      ...input,
      inHouseGross: input.inHouseGrossManual ? input.inHouseGross : null,
      teamCount: team.teamIds.length,
    });
    if (missing.length) {
      // Save everything else and leave the stage as it was — never lose the other edits.
      blocked = `Saved your changes, but the deal stays ${current}. Still needed to close: ${missing.join(", ")}. Click Closed on the stage bar to finish.`;
      input.stage = current!;
      closing = false;
    }
  }
  if (!id) {
    const newId = await createDeal(input, user);
    await syncTeam(newId, team);
    revalidatePath("/deals");
    redirect(`/deals/${newId}`, RedirectType.replace);
  }
  try {
    await assertCanEdit(id, user);
  } catch (e) {
    if (e instanceof DealLockedError) return { ok: false, message: e.message };
    throw e;
  }
  await updateDeal(id, input, user);
  await syncTeam(id, team);
  // A closed sale makes its buyer the properties' current owner.
  if (closing) await setOwnersForDeal(db, id);
  revalidatePath("/deals", "layout");
  revalidatePath("/reports", "layout");
  if (closing) revalidatePath("/properties", "layout");
  return blocked ? { ok: false, message: blocked } : { ok: true, message: "Saved." };
}

function refresh(dealId: string) {
  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/deals");
  // The Pipeline report's quick-edit panel moves stages too; keep the reports current.
  revalidatePath("/reports", "layout");
}

export async function addPropertyAction(dealId: string, fd: FormData) {
  const user = await editor(dealId);
  const propertyId = str(fd, "propertyId");
  if (!propertyId) return;
  await addDealProperty(dealId, propertyId, user.id);
  refresh(dealId);
  // Drop the ?addProperty= hint once it's been used.
  redirect(`/deals/${dealId}`, RedirectType.replace);
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

export type CloseState = { message: string; missing: string[] } | null;

/**
 * The "Close this deal" pop-up: saves what was filled in, then moves the deal to Closed
 * if nothing required is still missing (the one stage move that's blocked).
 */
export async function closeDealAction(dealId: string, _prev: CloseState, fd: FormData): Promise<CloseState> {
  let user;
  try {
    user = await editor(dealId);
  } catch (e) {
    if (e instanceof DealLockedError) return { message: e.message, missing: [] };
    throw e;
  }
  if ((await currentStage(dealId)) === "Closed") return null;
  // Only the fields the pop-up showed are in the form; leave everything else alone.
  const has = (k: string) => fd.has(k);
  const fields = {
    ...(has("closeDate") && { closeDate: str(fd, "closeDate") }),
    ...(has("closedPrice") && { closedPrice: dec(fd, "closedPrice") }),
    ...(has("totalCapitalization") && { totalCapitalization: dec(fd, "totalCapitalization") }),
    ...(has("loanAmount") && { loanAmount: dec(fd, "loanAmount") }),
    ...(has("totalLeaseConsideration") && { totalLeaseConsideration: dec(fd, "totalLeaseConsideration") }),
    ...(has("totalCommission") && { totalCommission: dec(fd, "totalCommission") }),
    ...(has("outsideCommission") && { outsideCommission: dec(fd, "outsideCommission") }),
    ...(has("reappsId") && { reappsId: str(fd, "reappsId") }),
    ...(has("dealType") && { dealType: oneOf(fd, "dealType", DEAL_TYPES) }),
    ...(has("dealSubtype") && { dealSubtype: oneOf(fd, "dealSubtype", DEAL_SUBTYPES) }),
    ...(has("opportunityType") && { opportunityType: oneOf(fd, "opportunityType", OPPORTUNITY_TYPES) }),
    ...(has("represented") && { represented: oneOf(fd, "represented", REPRESENTED) }),
  };
  await saveCloseFields(dealId, fields, str(fd, "buyerCompanyId"), user.id);
  const missing = await missingToClose(dealId);
  if (missing.length) {
    refresh(dealId);
    return { message: "Saved what you entered. This deal can't close until these are done:", missing };
  }
  await moveStage(dealId, { stage: "Closed", date: str(fd, "closeDate") }, user.id);
  await setOwnersForDeal(db, dealId);
  revalidatePath("/properties", "layout");
  refresh(dealId);
  return null;
}

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
  const closing = stage === "Closed" && (await currentStage(dealId)) !== "Closed";
  if (closing) {
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
      deadNote: fd.has("deadNote") ? str(fd, "deadNote") : undefined,
    },
    user.id,
  );
  if (closing) {
    await setOwnersForDeal(db, dealId);
    revalidatePath("/properties", "layout");
  }
  refresh(dealId);
  return null;
}

// ---- Quick edit (Pipeline report side panel, Haili 1.6) ----

export type QuickDeal = {
  id: string;
  dealName: string;
  stage: Stage;
  version: string;
  locked: boolean;
  dates: Partial<Record<"pitchDate" | "wonDate" | "launchDate" | "awardedDate" | "closeDate" | "followUpDate", string | null>>;
  keyDate: { field: KeyDateField; label: string; value: string | null } | null;
  price: { field: PriceField; label: string; value: string | null } | null;
  /** Shown from Engaged on, or whenever a fee is entered. */
  fee: { show: boolean; value: string | null };
  leadAnalystId: string | null;
  team: { id: string; name: string }[];
  notes: string | null;
  closeInfo: CloseInfo;
};

/** What the quick-edit panel needs for one deal. */
export async function quickDealAction(id: string): Promise<QuickDeal | null> {
  const user = await requireUser();
  const [data, team] = await Promise.all([getDeal(id), icmTeamOptions(id)]);
  if (!data) return null;
  const d = data.deal;
  const closeOnTabs = d.stage === "Closed" ? [] : (await missingToClose(id)).filter(needsDealTabs);
  const key = PIPELINE_KEY_DATE[d.stage];
  const price = stagePriceField(d.dealType, d.stage);
  return {
    id,
    dealName: d.dealName,
    stage: d.stage,
    version: d.lastModifiedAt.toISOString(),
    locked: isLockedFor(d.stage, user),
    dates: {
      pitchDate: d.pitchDate,
      wonDate: d.wonDate,
      launchDate: d.launchDate,
      awardedDate: d.awardedDate,
      closeDate: d.closeDate,
      followUpDate: d.followUpDate,
    },
    keyDate: key ? { ...key, value: d[key.field] } : null,
    price: price ? { ...price, value: d[price.field] } : null,
    fee: { show: FEE_STAGES.includes(d.stage) || d.totalCommission !== null, value: d.totalCommission },
    leadAnalystId: data.team.find((t) => t.isLeadAnalyst)?.contactId ?? null,
    team: team.map((t) => ({ id: t.id, name: t.name })),
    notes: d.closingNotes,
    closeInfo: {
      closeDate: d.closeDate,
      dealType: d.dealType,
      dealSubtype: d.dealSubtype,
      reappsId: d.reappsId,
      opportunityType: d.opportunityType,
      represented: d.represented,
      closedPrice: d.closedPrice,
      totalCapitalization: d.totalCapitalization,
      loanAmount: d.loanAmount,
      totalLeaseConsideration: d.totalLeaseConsideration,
      totalCommission: d.totalCommission,
      outsideCommission: d.outsideCommission,
      hasBuyer: data.parties.some((p) => p.side === "B"),
      onTabs: closeOnTabs,
    },
  };
}

const QUICK_DATES: KeyDateField[] = ["pitchDueDate", "pitchDate", "launchDate", "callForOffersDate", "ddExpirationDate", "closeDate", "followUpDate"];
const QUICK_PRICES: PriceField[] = ["bovPriceMid", "guidancePrice", "closedPrice", "totalCapitalization", "loanAmount", "totalLeaseConsideration"];

/** Saves the quick-edit panel: only the fields it sent (key date, price, fee, lead analyst, notes). */
export async function quickSaveDealAction(dealId: string, _prev: SaveState, fd: FormData): Promise<SaveState> {
  let user;
  try {
    user = await editor(dealId);
  } catch (e) {
    if (e instanceof DealLockedError) return { ok: false, message: e.message };
    throw e;
  }
  const set: Record<string, string | null> = {};
  for (const k of QUICK_DATES) if (fd.has(k)) set[k] = str(fd, k);
  for (const k of QUICK_PRICES) if (fd.has(k)) set[k] = dec(fd, k);
  if (fd.has("totalCommission")) set.totalCommission = dec(fd, "totalCommission");
  if (fd.has("closingNotes")) set.closingNotes = str(fd, "closingNotes");
  await quickUpdateDeal(dealId, set, user.id);
  if (fd.has("leadAnalystId")) await setLeadAnalyst(dealId, str(fd, "leadAnalystId"), user.id);
  refresh(dealId);
  return { ok: true, message: "Saved." };
}
