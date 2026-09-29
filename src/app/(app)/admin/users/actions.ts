"use server";

import { revalidatePath } from "next/cache";
import { addUser, requireAdmin, setUserActive } from "@/auth";

export type FormState = { message: string; ok: boolean } | null;

export async function addUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const result = await addUser(
    String(formData.get("name") ?? ""),
    String(formData.get("email") ?? ""),
    admin.id,
  );
  if (!result.ok) return { ok: false, message: result.message };
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
