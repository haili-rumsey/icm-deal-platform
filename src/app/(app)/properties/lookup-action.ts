"use server";

import { requireUser } from "@/auth";
import { geocodeAddress, type GeocodeResult } from "@/server/geocode";

export async function lookupAddressAction(query: string): Promise<GeocodeResult> {
  await requireUser();
  return geocodeAddress(query);
}
