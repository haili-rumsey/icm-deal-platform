"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/auth";
import { str } from "@/lib/form";
import { addCity, addSubmarket, removeCity, setSubmarketRetired } from "@/server/geography";

export type GeoFormState = { ok: boolean; message: string } | null;

function done() {
  revalidatePath("/admin/geography");
  revalidatePath("/properties", "layout");
}

export async function addCityAction(marketId: string, state: string, _prev: GeoFormState, fd: FormData): Promise<GeoFormState> {
  await requireAdmin();
  const city = str(fd, "city") ?? "";
  const result = await addCity(marketId, city, state);
  if (!result.ok) return result;
  done();
  return { ok: true, message: `${city.trim()} added.` };
}

/** From the "cities not on a list yet" panel: put a city on a chosen market's list. */
export async function mapCityAction(city: string, state: string, fd: FormData) {
  await requireAdmin();
  const marketId = str(fd, "marketId");
  if (!marketId) return;
  await addCity(marketId, city, state);
  done();
}

export async function removeCityAction(id: string) {
  await requireAdmin();
  await removeCity(id);
  done();
}

export async function addSubmarketAction(marketId: string, _prev: GeoFormState, fd: FormData): Promise<GeoFormState> {
  await requireAdmin();
  const name = str(fd, "name") ?? "";
  const result = await addSubmarket(marketId, name);
  if (!result.ok) return result;
  done();
  return { ok: true, message: `${name.trim()} added.` };
}

export async function setRetiredAction(id: string, retired: boolean) {
  await requireAdmin();
  await setSubmarketRetired(id, retired);
  done();
}
