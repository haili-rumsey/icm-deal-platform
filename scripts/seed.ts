/**
 * Creates the three admins (user administration, delete, closed-deal unlock), the
 * two companies the system relies on (Stream Realty Partners, Private Investors),
 * and a Stream contact for every user who doesn't have one yet.
 * Safe to run more than once. Run with: npm run db:seed
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const ADMINS = [
  { name: "Haili Rumsey", email: "haili.rumsey@streamrealty.com" },
  { name: "Seth Koschak", email: "skoschak@streamrealty.com" },
  { name: "Matteson Hamilton", email: "mhamilton@streamrealty.com" },
];

async function main() {
  const { db } = await import("../src/db");
  const { users, companies, contacts } = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");

  for (const a of ADMINS) {
    await db
      .insert(users)
      .values({ ...a, isAdmin: true, isActive: true })
      .onConflictDoUpdate({ target: users.email, set: { isAdmin: true } });
    console.log(`admin ready: ${a.name}`);
  }

  await db
    .insert(companies)
    .values([
      { name: "Stream Realty Partners", website: "streamrealty.com", websiteDomain: "streamrealty.com", types: ["Brokerage"], systemKey: "stream" },
      {
        name: "Private Investors",
        noWebsite: true,
        types: ["Investor"],
        notes: "General company for individuals who don't have their own company.",
        systemKey: "private_investors",
      },
    ])
    .onConflictDoNothing({ target: companies.systemKey });
  const [stream] = await db.select({ id: companies.id }).from(companies).where(eq(companies.systemKey, "stream"));
  console.log("system companies ready");

  // Users and contacts are matched by email.
  for (const u of await db.select().from(users)) {
    const [existing] = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.email, u.email));
    if (existing) continue;
    const parts = (u.name ?? u.email.split("@")[0]).trim().split(/\s+/);
    const lastName = parts.length > 1 ? parts.pop()! : "";
    // Admins start on the ICM team roster; everyone else is added on Manage teams.
    await db
      .insert(contacts)
      .values({ companyId: stream.id, firstName: parts.join(" "), lastName, email: u.email, isIcmTeam: u.isAdmin });
    console.log(`contact created: ${u.name ?? u.email}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
