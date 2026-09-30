"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireUser } from "@/auth";
import { deleteRecord, isEntityKind, setArchived } from "@/server/housekeeping";

const LIST_PATH = { deal: "/deals", property: "/properties", company: "/companies", contact: "/contacts" } as const;

export async function archiveAction(formData: FormData) {
  const user = await requireUser();
  const kind = String(formData.get("kind"));
  const id = String(formData.get("id"));
  if (!isEntityKind(kind)) return;
  await setArchived(kind, id, formData.get("archived") === "true", user.id);
  revalidatePath(LIST_PATH[kind], "layout");
}

export type DeleteState = { message: string } | null;

export async function deleteAction(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  await requireAdmin();
  const kind = String(formData.get("kind"));
  const id = String(formData.get("id"));
  if (!isEntityKind(kind)) return { message: "Unknown record type." };
  const result = await deleteRecord(kind, id);
  if (!result.ok) return { message: result.message };
  revalidatePath(LIST_PATH[kind], "layout");
  redirect(LIST_PATH[kind]);
}
