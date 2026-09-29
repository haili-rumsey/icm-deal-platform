/**
 * Creates the three admins (user administration, delete, closed-deal unlock).
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
  const { users } = await import("../src/db/schema");
  for (const a of ADMINS) {
    await db
      .insert(users)
      .values({ ...a, isAdmin: true, isActive: true })
      .onConflictDoUpdate({ target: users.email, set: { isAdmin: true } });
    console.log(`admin ready: ${a.name}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
