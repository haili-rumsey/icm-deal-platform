"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { requireUser } from "@/auth";
import type { SaveState } from "@/components/record-page";
import { bool, str } from "@/lib/form";
import { createContact, updateContact, type ContactInput } from "@/server/contacts";

function parse(fd: FormData): ContactInput | string {
  const companyId = str(fd, "companyId");
  const firstName = str(fd, "firstName");
  const email = str(fd, "email");
  const noEmail = bool(fd, "noEmail");
  if (!companyId) return "Pick a company. Individuals without one go under “Private Investors”.";
  if (!firstName) return "Enter at least a first name.";
  // Hard requirement from the PRD, with an explicit override.
  if (!email && !noEmail) return "Enter an email, or tick “No email”.";
  return {
    companyId,
    firstName,
    lastName: str(fd, "lastName") ?? "",
    title: str(fd, "title"),
    email,
    noEmail,
    phone: str(fd, "phone"),
    notes: str(fd, "notes"),
  };
}

export async function saveContact(id: string | null, _prev: SaveState, fd: FormData): Promise<SaveState> {
  const user = await requireUser();
  const input = parse(fd);
  if (typeof input === "string") return { ok: false, message: input };
  if (!id) {
    const newId = await createContact(input, user.id);
    revalidatePath("/contacts");
    redirect(`/contacts/${newId}`, RedirectType.replace);
  }
  await updateContact(id, input, user.id);
  revalidatePath("/contacts", "layout");
  return { ok: true, message: "Saved." };
}
