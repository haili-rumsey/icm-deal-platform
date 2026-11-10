"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/auth";
import { NOTE_SOURCES } from "@/domain/options";
import { oneOf, str } from "@/lib/form";
import { createNote, deleteNote, updateNote, type NoteInput } from "@/server/notes";

export type NoteFormState = { message: string | null; saved?: number };

function parse(fd: FormData): NoteInput | string {
  const companyId = str(fd, "companyId");
  const body = str(fd, "body");
  if (!companyId) return "Pick the company this note belongs to.";
  if (!body) return "Write the note.";
  return {
    companyId,
    dealId: str(fd, "dealId"),
    contactId: str(fd, "contactId"),
    authorId: str(fd, "authorId"),
    source: oneOf(fd, "source", NOTE_SOURCES),
    subject: str(fd, "subject"),
    body,
  };
}

function refresh() {
  // Notes show on company, deal and contact pages and the Notes list.
  revalidatePath("/notes");
  revalidatePath("/companies", "layout");
  revalidatePath("/deals", "layout");
  revalidatePath("/contacts", "layout");
}

/** Adds a note (noteId null) or saves changes to one. */
export async function saveNoteAction(noteId: string | null, prev: NoteFormState, fd: FormData): Promise<NoteFormState> {
  const user = await requireUser();
  const input = parse(fd);
  if (typeof input === "string") return { message: input, saved: prev.saved };
  if (noteId) await updateNote(noteId, input, user.id);
  else await createNote(input, user.id);
  refresh();
  return { message: null, saved: (prev.saved ?? 0) + 1 };
}

/** Records are deleted only by the three admins. */
export async function deleteNoteAction(noteId: string) {
  await requireAdmin();
  await deleteNote(noteId);
  refresh();
}
