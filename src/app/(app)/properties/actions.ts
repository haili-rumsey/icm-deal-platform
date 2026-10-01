"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import type { SaveState } from "@/components/record-page";
import { BUILDING_CLASSES, CONFIGURATIONS, SPRINKLER_TYPES, TENANCY } from "@/domain/options";
import { dec, ids, int, oneOf, str } from "@/lib/form";
import { createProperty, updateProperty, type PropertyInput } from "@/server/properties";

function parse(fd: FormData): PropertyInput {
  const verified = fd.get("addressVerified") === "true";
  return {
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
    redirect(dealId ? `/deals/${dealId}?addProperty=${newId}` : `/properties/${newId}`);
  }
  await updateProperty(id, input, owners, user.id);
  revalidatePath("/properties", "layout");
  revalidatePath("/deals", "layout");
  return { ok: true, message: "Saved." };
}
