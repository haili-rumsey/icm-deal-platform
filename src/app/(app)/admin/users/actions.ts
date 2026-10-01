"use server";

import { revalidatePath } from "next/cache";
import { addUser, requireAdmin, setUserActive } from "@/auth";
import { addToIcmTeam, ensureStreamContact } from "@/server/contacts";

export type FormState = { message: string; ok: boolean } | null;

export async function addUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "");
  if (!firstName || !lastName) return { ok: false, message: "Enter a first and last name." };
  const result = await addUser(`${firstName} ${lastName}`, email, admin.id);
  if (!result.ok) return { ok: false, message: result.message };
  // The user and their Stream contact are the same person, matched by email.
  await ensureStreamContact(firstName, lastName, email, admin.id);
  if (formData.get("addToTeam") === "on") await addToIcmTeam(firstName, lastName, email, admin.id);
  revalidatePath("/admin/users");
  return { ok: true, message: "User added. They can now request a sign-in link." };
}

export async function setActiveAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const active = formData.get("active") === "true";
  await setUserActive(userId, active, admin.id);
  revalidatePath("/admin/users");
}
