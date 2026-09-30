import "server-only";
import { and, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, dealParties, deals } from "@/db/schema";
import { PRIVATE_INVESTORS_NAME, STREAM_COMPANY_NAME, STREAM_WEBSITE } from "@/domain/options";

export type Company = typeof companies.$inferSelect;
export type CompanyInput = Pick<
  Company,
  "name" | "website" | "noWebsite" | "types" | "investmentStrategies" | "notes"
>;

/** "https://www.Blackstone.com/about" → "blackstone.com" */
export function websiteDomain(website: string | null | undefined): string | null {
  if (!website?.trim()) return null;
  const raw = website.trim().toLowerCase();
  try {
    const host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
    return host.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

export async function listCompanies(opts: { q?: string; archived?: boolean } = {}) {
  const where = [opts.archived ? sql`${companies.archivedAt} is not null` : isNull(companies.archivedAt)];
  if (opts.q?.trim()) {
    const like = `%${opts.q.trim()}%`;
    where.push(or(ilike(companies.name, like), ilike(companies.websiteDomain, like))!);
  }
  return db
    .select({
      id: companies.id,
      name: companies.name,
      websiteDomain: companies.websiteDomain,
      noWebsite: companies.noWebsite,
      types: companies.types,
      archivedAt: companies.archivedAt,
      contactCount: sql<number>`(select count(*)::int from contacts ct where ct.company_id = "companies"."id" and ct.archived_at is null)`,
    })
    .from(companies)
    .where(and(...where))
    .orderBy(asc(companies.name));
}

/** Lightweight list for pickers. */
export async function companyOptions() {
  return db
    .select({ id: companies.id, name: companies.name, domain: companies.websiteDomain })
    .from(companies)
    .where(isNull(companies.archivedAt))
    .orderBy(asc(companies.name));
}

export async function getCompany(id: string) {
  const [company] = await db.select().from(companies).where(eq(companies.id, id));
  return company ?? null;
}

export async function createCompany(input: CompanyInput, byId: string) {
  const [row] = await db
    .insert(companies)
    .values({
      ...input,
      websiteDomain: input.noWebsite ? null : websiteDomain(input.website),
      website: input.noWebsite ? null : input.website,
      createdById: byId,
      lastModifiedById: byId,
    })
    .returning({ id: companies.id });
  return row.id;
}

export async function updateCompany(id: string, input: CompanyInput, byId: string) {
  await db
    .update(companies)
    .set({
      ...input,
      websiteDomain: input.noWebsite ? null : websiteDomain(input.website),
      website: input.noWebsite ? null : input.website,
      lastModifiedAt: new Date(),
      lastModifiedById: byId,
    })
    .where(eq(companies.id, id));
}

/** The companies the system relies on. Safe to call repeatedly. */
export async function ensureSystemCompanies() {
  await db
    .insert(companies)
    .values([
      {
        name: STREAM_COMPANY_NAME,
        website: STREAM_WEBSITE,
        websiteDomain: STREAM_WEBSITE,
        types: ["Brokerage"],
        systemKey: "stream",
      },
      {
        name: PRIVATE_INVESTORS_NAME,
        noWebsite: true,
        types: ["Investor"],
        notes: "General company for individuals who don't have their own company.",
        systemKey: "private_investors",
      },
    ])
    .onConflictDoNothing({ target: companies.systemKey });
}

export async function streamCompanyId(): Promise<string> {
  const [row] = await db.select({ id: companies.id }).from(companies).where(eq(companies.systemKey, "stream"));
  if (row) return row.id;
  // Normally created by the seed; create on first use if it's missing.
  await ensureSystemCompanies();
  return streamCompanyId();
}

/** Deals this company is a party to, on either side. */
export async function companyDeals(id: string) {
  return db
    .selectDistinct({ id: deals.id, dealName: deals.dealName, dealType: deals.dealType, side: dealParties.side })
    .from(dealParties)
    .innerJoin(deals, eq(deals.id, dealParties.dealId))
    .where(eq(dealParties.companyId, id))
    .orderBy(asc(deals.dealName));
}
