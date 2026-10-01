"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/auth";
import { LOCATIONS } from "@/domain/options";
import { oneOf, str } from "@/lib/form";
import { addToIcmTeam, normalizeContactEmail, removeFromIcmTeam, setLocation } from "@/server/contacts";

export type TeamFormState = { ok: boolean; message: string } | null;

export async function addTeamMemberAction(_prev: TeamFormState, fd: FormData): Promise<TeamFormState> {
  const admin = await requireAdmin();
  const firstName = str(fd, "firstName");
  const lastName = str(fd, "lastName");
  const email = normalizeContactEmail(str(fd, "email"));
  if (!firstName || !lastName) return { ok: false, message: "Enter a first and last name." };
  if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) return { ok: false, message: "Enter their email." };
  // Same email = same person: an existing contact is reused, not duplicated.
  await addToIcmTeam(firstName, lastName, email, admin.id, oneOf(fd, "location", LOCATIONS));
  revalidatePath("/admin/teams");
  return { ok: true, message: `${firstName} ${lastName} added to the ICM team.` };
}

export async function removeTeamMemberAction(contactId: string) {
  const admin = await requireAdmin();
  await removeFromIcmTeam(contactId, admin.id);
  revalidatePath("/admin/teams");
}

export async function setLocationAction(contactId: string, location: string) {
  const admin = await requireAdmin();
  await setLocation(contactId, LOCATIONS.find((l) => l === location) ?? null, admin.id);
  revalidatePath("/admin/teams");
}
