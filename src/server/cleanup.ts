import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export type CleanupRow = {
  id: string;
  kind: "Deal" | "Property" | "Company" | "Contact";
  name: string;
  href: string;
  issue: string;
  details: string | null;
  /** Deal stage, or the deals a property / company is on. */
  context: string | null;
  modifiedAt: Date;
};

/** Deal-notes lines that explain why a deal has no address (from the active-deals import). */
const WHY_NO_ADDRESS = /map link|back-filled|left blank|building numbers/i;

/**
 * The "Needs cleanup" report (Haili, 1.6): everything waiting to be filled in, in one
 * place — deals with no property, properties with neither a Google match nor a pin placed
 * by hand, companies marked "no website", contacts marked "no email". Archived records are left out. A row drops
 * off as soon as the record is fixed.
 */
export async function listCleanup(): Promise<CleanupRow[]> {
  const [deals, props, companies, contacts] = await Promise.all([
    db.execute<{ id: string; name: string; stage: string; notes: string | null; modified_at: Date }>(sql`
      select d.id, d.deal_name as name, d.stage, d.closing_notes as notes, d.last_modified_at as modified_at
      from deals d
      where d.archived_at is null
        and d.deal_type is distinct from 'Consulting'
        and not exists (select 1 from deal_properties dp where dp.deal_id = d.id)`),
    db.execute<{ id: string; name: string | null; address: string | null; city: string | null; state: string | null; deals: string | null; modified_at: Date }>(sql`
      select p.id, p.name, p.address, p.city, p.state, p.last_modified_at as modified_at,
        (select string_agg(d.deal_name, ', ' order by d.deal_name) from deal_properties dp join deals d on d.id = dp.deal_id where dp.property_id = p.id) as deals
      from properties p
      where p.archived_at is null and not p.address_verified and not p.pin_manual`),
    db.execute<{ id: string; name: string; deals: number; modified_at: Date }>(sql`
      select c.id, c.name, c.last_modified_at as modified_at,
        (select count(distinct dp.deal_id)::int from deal_parties dp where dp.company_id = c.id) as deals
      from companies c
      where c.archived_at is null and c.no_website`),
    db.execute<{ id: string; name: string; company: string; modified_at: Date }>(sql`
      select ct.id, ct.first_name || ' ' || ct.last_name as name, co.name as company, ct.last_modified_at as modified_at
      from contacts ct join companies co on co.id = ct.company_id
      where ct.archived_at is null and ct.no_email`),
  ]);

  return [
    ...deals.rows.map((d) => ({
      id: d.id,
      kind: "Deal" as const,
      name: d.name,
      href: `/deals/${d.id}`,
      issue: "No property (address)",
      details: (d.notes ?? "").split("\n").filter((l) => WHY_NO_ADDRESS.test(l)).join(" ") || null,
      context: d.stage,
      modifiedAt: new Date(d.modified_at),
    })),
    ...props.rows.map((p) => ({
      id: p.id,
      kind: "Property" as const,
      name: [p.name, p.address].filter(Boolean).join(" — ") || "(no address)",
      href: `/properties/${p.id}`,
      issue: "No Google match",
      details: [p.city, p.state].filter(Boolean).join(", ") || null,
      context: p.deals,
      modifiedAt: new Date(p.modified_at),
    })),
    ...companies.rows.map((c) => ({
      id: c.id,
      kind: "Company" as const,
      name: c.name,
      href: `/companies/${c.id}`,
      issue: "No website",
      details: null,
      context: c.deals ? `${c.deals} deal${c.deals === 1 ? "" : "s"}` : null,
      modifiedAt: new Date(c.modified_at),
    })),
    ...contacts.rows.map((c) => ({
      id: c.id,
      kind: "Contact" as const,
      name: c.name,
      href: `/contacts/${c.id}`,
      issue: "No email",
      details: c.company,
      context: null,
      modifiedAt: new Date(c.modified_at),
    })),
  ];
}
