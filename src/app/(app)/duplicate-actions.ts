"use server";

import { requireUser } from "@/auth";
import { companiesWithDomain, contactsWithEmail, propertiesAtPlace, type Match } from "@/server/duplicates";

// Warnings only: these never stop a save.

export async function checkCompanyWebsite(excludeId: string | null, website: string): Promise<Match[]> {
  await requireUser();
  return companiesWithDomain(website, excludeId ?? undefined);
}

export async function checkContactEmail(excludeId: string | null, email: string): Promise<Match[]> {
  await requireUser();
  return contactsWithEmail(email, excludeId ?? undefined);
}

export async function checkPlace(excludeId: string | null, placeId: string, buildingDesignation: string | null) {
  await requireUser();
  return propertiesAtPlace(placeId, buildingDesignation, excludeId ?? undefined);
}
