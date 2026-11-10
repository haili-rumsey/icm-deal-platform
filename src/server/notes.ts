import "server-only";
import { and, asc, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { companies, contacts, deals, notes, users } from "@/db/schema";
import type { NoteSource } from "@/domain/options";

/**
 * Notes (PRD §5, milestone 2.2). A note's home is its company; the deal tag also surfaces it
 * on the deal, and the contact on the contact. Author = an ICM team member; entered-by = the
 * signed-in user who typed it. The body stays editable and is last-modified stamped.
 */

export type NoteInput = {
  companyId: string;
  dealId: string | null;
  contactId: string | null;
  authorId: string | null;
  source: NoteSource | null;
  subject: string | null;
  body: string;
};

const author = alias(contacts, "author");
const person = alias(contacts, "person");
const enteredBy = alias(users, "entered_by");

export type NoteRow = Awaited<ReturnType<typeof listNotes>>[number];

export async function listNotes(opts: { companyId?: string; dealId?: string; contactId?: string } = {}) {
  const where: SQL[] = [isNull(notes.archivedAt)];
  if (opts.companyId) where.push(eq(notes.companyId, opts.companyId));
  if (opts.dealId) where.push(eq(notes.dealId, opts.dealId));
  if (opts.contactId) where.push(eq(notes.contactId, opts.contactId));
  return db
    .select({
      id: notes.id,
      companyId: notes.companyId,
      companyName: companies.name,
      dealId: notes.dealId,
      dealName: deals.dealName,
      contactId: notes.contactId,
      contactName: sql<string | null>`${person.firstName} || ' ' || ${person.lastName}`,
      authorId: notes.authorId,
      authorName: sql<string | null>`${author.firstName} || ' ' || ${author.lastName}`,
      enteredByName: enteredBy.name,
      enteredByEmail: enteredBy.email,
      loggedAt: notes.loggedAt,
      source: notes.source,
      subject: notes.subject,
      body: notes.body,
      lastModifiedAt: notes.lastModifiedAt,
    })
    .from(notes)
    .innerJoin(companies, eq(companies.id, notes.companyId))
    .leftJoin(deals, eq(deals.id, notes.dealId))
    .leftJoin(person, eq(person.id, notes.contactId))
    .leftJoin(author, eq(author.id, notes.authorId))
    .leftJoin(enteredBy, eq(enteredBy.id, notes.enteredById))
    .where(and(...where))
    .orderBy(desc(notes.loggedAt));
}

export async function createNote(input: NoteInput, byId: string) {
  await db.insert(notes).values({ ...input, enteredById: byId, createdById: byId, lastModifiedById: byId });
}

export async function updateNote(id: string, input: NoteInput, byId: string) {
  await db
    .update(notes)
    .set({ ...input, lastModifiedAt: new Date(), lastModifiedById: byId })
    .where(eq(notes.id, id));
}

/** Delete is for notes created in error — admins only (checked by the caller). */
export async function deleteNote(id: string) {
  await db.delete(notes).where(eq(notes.id, id));
}

/** Deals a note can be tagged to: every deal that isn't archived. */
export async function noteDealOptions() {
  const rows = await db
    .select({ id: deals.id, name: deals.dealName, stage: deals.stage })
    .from(deals)
    .where(isNull(deals.archivedAt))
    .orderBy(asc(deals.dealName));
  return rows.map((r) => ({ id: r.id, name: r.name, hint: r.stage }));
}
