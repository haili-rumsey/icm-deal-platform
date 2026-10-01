"use server";

import { requireUser } from "@/auth";
import {
  geocodeAddress,
  geocodePlace,
  suggestAddresses,
  type GeocodeResult,
  type SuggestResult,
} from "@/server/geocode";

export async function lookupAddressAction(query: string): Promise<GeocodeResult> {
  await requireUser();
  return geocodeAddress(query);
}

export async function suggestAddressesAction(input: string, sessionToken: string): Promise<SuggestResult> {
  await requireUser();
  return suggestAddresses(input, sessionToken);
}

export async function resolvePlaceAction(placeId: string): Promise<GeocodeResult> {
  await requireUser();
  return geocodePlace(placeId);
}
