"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { requireUser } from "@/auth";
import type { SaveState } from "@/components/record-page";
import { BUILDING_CLASSES, CONFIGURATIONS, SPRINKLER_TYPES, TENANCY } from "@/domain/options";
import { dec, ids, int, oneOf, str } from "@/lib/form";
import { geocodeAddress } from "@/server/geocode";
import { createProperty, getProperty, setPropertyPin, updateProperty, type PropertyInput } from "@/server/properties";

function parse(fd: FormData): PropertyInput {
  const verified = fd.get("addressVerified") === "true";
  return {
    name: str(fd, "name"),
    address: str(fd, "address"),
    city: str(fd, "city"),
    state: str(fd, "state"),
    zip: str(fd, "zip"),
    county: str(fd, "county"),
    submarketId: str(fd, "submarketId"),
    buildingDesignation: str(fd, "buildingDesignation"),
    googlePlaceId: verified ? str(fd, "googlePlaceId") : null,
    lat: verified ? dec(fd, "lat") : null,
    lng: verified ? dec(fd, "lng") : null,
    addressVerified: verified,
    buildingSf: int(fd, "buildingSf"),
    acreage: dec(fd, "acreage"),
    occupancyPct: dec(fd, "occupancyPct"),
    tenancy: oneOf(fd, "tenancy", TENANCY),
    buildingClass: oneOf(fd, "buildingClass", BUILDING_CLASSES),
    yearBuilt: int(fd, "yearBuilt"),
    clearHeightFt: dec(fd, "clearHeightFt"),
    configuration: oneOf(fd, "configuration", CONFIGURATIONS),
    dockDoors: int(fd, "dockDoors"),
    officeFinishSf: int(fd, "officeFinishSf"),
    sprinklerType: oneOf(fd, "sprinklerType", SPRINKLER_TYPES),
  };
}

export async function saveProperty(id: string | null, _prev: SaveState, fd: FormData): Promise<SaveState> {
  const user = await requireUser();
  const input = parse(fd);
  const owners = ids(fd, "ownerIds");
  if (!id) {
    const newId = await createProperty(input, owners, user.id);
    revalidatePath("/properties");
    // Coming from a deal: attach the new property to it straight away.
    const dealId = str(fd, "returnToDeal");
    redirect(dealId ? `/deals/${dealId}?addProperty=${newId}` : `/properties/${newId}`, RedirectType.replace);
  }
  await updateProperty(id, input, owners, user.id);
  revalidatePath("/properties", "layout");
  revalidatePath("/deals", "layout");
  return { ok: true, message: "Saved." };
}

/** Adjust pin: where to start the map for a property with no pin yet — its city, via Google. */
export async function pinStartAction(id: string): Promise<{ lat: number; lng: number } | null> {
  await requireUser();
  const data = await getProperty(id);
  if (!data) return null;
  const { city, state, zip } = data.property;
  const place = [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  if (!place) return null;
  const res = await geocodeAddress(place);
  return res.ok && res.matches[0] ? { lat: res.matches[0].lat, lng: res.matches[0].lng } : null;
}

/** Adjust pin: save the spot the pin was dragged to. */
export async function savePinAction(id: string, lat: number, lng: number): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { ok: false };
  await setPropertyPin(id, lat, lng, user.id);
  revalidatePath("/properties", "layout");
  revalidatePath("/reports/cleanup");
  return { ok: true };
}
