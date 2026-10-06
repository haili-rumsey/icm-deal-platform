"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { requireUser } from "@/auth";
import type { SaveState } from "@/components/record-page";
import { COMPANY_TYPES, INVESTMENT_STRATEGIES } from "@/domain/options";
import { bool, manyOf, str } from "@/lib/form";
import { createCompany, updateCompany, type CompanyInput } from "@/server/companies";

function parse(fd: FormData): CompanyInput | string {
  const name = str(fd, "name");
  const noWebsite = bool(fd, "noWebsite");
  const website = str(fd, "website");
  if (!name) return "Enter the company name.";
  // Hard requirement from the PRD, with an explicit override.
  if (!website && !noWebsite) return "Enter a website, or tick “No website”.";
  return {
    name,
    website,
    noWebsite,
    types: manyOf(fd, "types", COMPANY_TYPES),
    investmentStrategies: manyOf(fd, "investmentStrategies", INVESTMENT_STRATEGIES),
    notes: str(fd, "notes"),
  };
}

export async function saveCompany(id: string | null, _prev: SaveState, fd: FormData): Promise<SaveState> {
  const user = await requireUser();
  const input = parse(fd);
  if (typeof input === "string") return { ok: false, message: input };
  if (!id) {
    const newId = await createCompany(input, user.id);
    revalidatePath("/companies");
    redirect(`/companies/${newId}`, RedirectType.replace);
  }
  await updateCompany(id, input, user.id);
  revalidatePath("/companies", "layout");
  return { ok: true, message: "Saved." };
}
