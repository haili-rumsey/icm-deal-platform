import "server-only";
import { and, asc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, contacts, dealTeam } from "@/db/schema";
import { streamCompanyId } from "./companies";

export type Contact = typeof contacts.$inferSelect;
export type ContactInput = Pick<
  Contact,
  "companyId" | "firstName" | "lastName" | "title" | "email" | "noEmail" | "phone" | "notes"
>;

export function normalizeContactEmail(email: string | null | undefined): string | null {
  const e = email?.trim().toLowerCase();
  return e ? e : null;
}

const fullName = sql<string>`${contacts.firstName} || ' ' || ${contacts.lastName}`;

export async function listContacts(opts: { q?: string; archived?: boolean; companyId?: string } = {}) {
  const where = [opts.archived ? sql`${contacts.archivedAt} is not null` : isNull(contacts.archivedAt)];
  if (opts.companyId) where.push(eq(contacts.companyId, opts.companyId));
  if (opts.q?.trim()) {
    const like = `%${opts.q.trim()}%`;
    where.push(or(ilike(fullName, like), ilike(contacts.email, like), ilike(companies.name, like))!);
  }
  return db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      title: contacts.title,
      email: contacts.email,
      noEmail: contacts.noEmail,
      phone: contacts.phone,
      companyId: contacts.companyId,
      companyName: companies.name,
    })
    .from(contacts)
    .innerJoin(companies, eq(companies.id, contacts.companyId))
    .where(and(...where))
    .orderBy(asc(contacts.lastName), asc(contacts.firstName));
}

/** Pickers: every active contact with their company. */
export async function contactOptions() {
  return db
    .select({ id: contacts.id, name: fullName, companyId: contacts.companyId, companyName: companies.name })
    .from(contacts)
    .innerJoin(companies, eq(companies.id, contacts.companyId))
    .where(isNull(contacts.archivedAt))
    .orderBy(asc(contacts.lastName), asc(contacts.firstName));
}

/** Pickers for Deal Team and Referral: Stream Realty Partners people only. */
export async function streamPeopleOptions() {
  return db
    .select({ id: contacts.id, name: fullName })
    .from(contacts)
    .innerJoin(companies, eq(companies.id, contacts.companyId))
    .where(and(eq(companies.systemKey, "stream"), isNull(contacts.archivedAt)))
    .orderBy(asc(contacts.lastName), asc(contacts.firstName));
}

export async function getContact(id: string) {
  const [row] = await db
    .select({ contact: contacts, companyName: companies.name })
    .from(contacts)
    .innerJoin(companies, eq(companies.id, contacts.companyId))
    .where(eq(contacts.id, id));
  return row ?? null;
}

export async function createContact(input: ContactInput, byId: string) {
  const [row] = await db
    .insert(contacts)
    .values({
      ...input,
      email: input.noEmail ? null : normalizeContactEmail(input.email),
      createdById: byId,
      lastModifiedById: byId,
    })
    .returning({ id: contacts.id });
  return row.id;
}

export async function updateContact(id: string, input: ContactInput, byId: string) {
  await db
    .update(contacts)
    .set({
      ...input,
      email: input.noEmail ? null : normalizeContactEmail(input.email),
      lastModifiedAt: new Date(),
      lastModifiedById: byId,
    })
    .where(eq(contacts.id, id));
}

/**
 * A user is the same person as the contact with the same email. When a user is
 * added, make sure their Stream contact exists.
 */
export async function ensureStreamContact(firstName: string, lastName: string, email: string, byId: string | null) {
  const address = normalizeContactEmail(email)!;
  const [existing] = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.email, address));
  if (existing) return existing.id;
  const [row] = await db
    .insert(contacts)
    .values({
      companyId: await streamCompanyId(),
      firstName,
      lastName,
      email: address,
      createdById: byId,
      lastModifiedById: byId,
    })
    .returning({ id: contacts.id });
  return row.id;
}

/** The signed-in user's own contact record, matched by email. */
export async function contactIdForEmail(email: string) {
  const [row] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.email, normalizeContactEmail(email)!));
  return row?.id ?? null;
}

// ---- ICM team roster (admin "ICM team" screen) ----

/** Everyone on the roster, for the admin screen. */
export async function listIcmTeam() {
  return db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      title: contacts.title,
      email: contacts.email,
      location: contacts.location,
    })
    .from(contacts)
    .where(and(eq(contacts.isIcmTeam, true), isNull(contacts.archivedAt)))
    .orderBy(asc(contacts.lastName), asc(contacts.firstName));
}

/**
 * Deal team dropdown: the roster, plus anyone already on this deal who has since
 * left the roster (so saving a deal never silently drops them).
 */
export async function icmTeamOptions(dealId?: string) {
  const onRoster = and(eq(contacts.isIcmTeam, true), isNull(contacts.archivedAt));
  const onThisDeal = dealId
    ? inArray(contacts.id, db.select({ id: dealTeam.contactId }).from(dealTeam).where(eq(dealTeam.dealId, dealId)))
    : undefined;
  return db
    .select({ id: contacts.id, name: fullName })
    .from(contacts)
    .where(onThisDeal ? or(onRoster, onThisDeal) : onRoster)
    .orderBy(asc(contacts.lastName), asc(contacts.firstName));
}

/** Adds someone to the roster, creating their Stream contact if the email is new. */
export async function addToIcmTeam(
  firstName: string,
  lastName: string,
  email: string,
  byId: string,
  location: Contact["location"] = null,
) {
  const id = await ensureStreamContact(firstName, lastName, email, byId);
  await db
    .update(contacts)
    .set({ isIcmTeam: true, ...(location ? { location } : {}), lastModifiedAt: new Date(), lastModifiedById: byId })
    .where(eq(contacts.id, id));
}

/** Off the roster: gone from the dropdown for new deals, still on past deals. */
export async function removeFromIcmTeam(contactId: string, byId: string) {
  await db
    .update(contacts)
    .set({ isIcmTeam: false, lastModifiedAt: new Date(), lastModifiedById: byId })
    .where(eq(contacts.id, contactId));
}

export async function setLocation(contactId: string, location: Contact["location"], byId: string) {
  await db
    .update(contacts)
    .set({ location, lastModifiedAt: new Date(), lastModifiedById: byId })
    .where(eq(contacts.id, contactId));
}
