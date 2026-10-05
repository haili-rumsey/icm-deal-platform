/**
 * Historical import (milestone 1.5): loads accounting's closed-deal export.
 *
 *   npm run db:import-history -- --source <export.xlsx> --answers <reviewed-answers.json>
 *       Practice run: does the whole import inside a transaction, prints the
 *       report, then rolls everything back. Nothing is saved.
 *   ... --commit
 *       Real run: same thing, but keeps it.
 *
 * Options: --as <email> (whose name goes on created/modified; default Haili).
 * Addresses are checked with Google once and cached next to the answers file
 * (geocode-cache.json), so a practice run and the real run match exactly.
 * Deals whose REApps ID is already in the system are skipped, so re-running is safe.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { setDefaultAutoSelectFamily } from "node:net";
// Some local networks stall ~8 s per request while Node tries IPv6 first; go straight to IPv4.
setDefaultAutoSelectFamily(false);

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

class Rollback extends Error {}

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const source = arg("source");
  const answersPath = arg("answers");
  if (!source || !answersPath) throw new Error("Usage: --source <export.xlsx> --answers <reviewed-answers.json> [--commit]");
  const commit = process.argv.includes("--commit");
  const asEmail = arg("as") ?? "haili.rumsey@streamrealty.com";

  const ExcelJS = (await import("exceljs")).default;
  const { Pool } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const { eq } = await import("drizzle-orm");
  const schema = await import("../src/db/schema");
  const { headerKey, toImportDeal } = await import("../src/domain/historical-import");
  type ImportProperty = import("../src/domain/historical-import").ImportProperty;
  type ReviewedAnswers = import("../src/domain/historical-import").ReviewedAnswers;
  const { geocodeAddress } = await import("../src/server/geocode");
  type GeocodeMatch = import("../src/server/geocode").GeocodeMatch;
  const { importCheck, importDeals } = await import("../src/server/historical-import");

  // ---- Read the export ----
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(source);
  const ws = wb.getWorksheet("Deal Activity") ?? wb.worksheets[0];
  const cellValue = (v: unknown): string | number | Date | null => {
    if (v === null || v === undefined) return null;
    if (v instanceof Date || typeof v === "number" || typeof v === "string") return v;
    if (typeof v === "object" && "result" in v) return cellValue((v as { result: unknown }).result);
    if (typeof v === "object" && "richText" in v) return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("");
    if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text);
    return String(v);
  };
  let headers: string[] | null = null;
  const sourceRows: Record<string, string | number | Date | null>[] = [];
  ws.eachRow((row) => {
    const values = (row.values as unknown[]).slice(1).map(cellValue);
    if (!headers) {
      if (values.some((v) => typeof v === "string" && headerKey(v) === "deal id")) headers = values.map((v) => headerKey(String(v ?? "")));
      return;
    }
    const rec: Record<string, string | number | Date | null> = {};
    headers.forEach((h, i) => h && (rec[h] = values[i] ?? null));
    if (rec["deal id"] !== null && String(rec["deal id"]).trim()) sourceRows.push(rec);
  });
  if (!headers) throw new Error("Couldn't find the header row (a cell reading “Deal Id”).");
  const hasIosColumn = (headers as string[]).some((h) => h === "ios" || h === "ios deal");

  const answers: ReviewedAnswers & { renameExisting?: Record<string, string> } = JSON.parse(readFileSync(answersPath, "utf8"));
  const prepared = sourceRows.map((r) => toImportDeal(r, answers));
  console.log(`Read ${prepared.length} deals from the export.${hasIosColumn ? "" : " (No IOS column — no deal will be flagged IOS.)"}`);

  // ---- Google: check every address once, before the database is touched ----
  const cachePath = join(dirname(answersPath), "geocode-cache.json");
  const cache: Record<string, GeocodeMatch | null> = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
  const query = (p: ImportProperty) => `${p.address}, ${p.city}, ${p.state}`;
  // Accept Google's answer only if it's the same street number (within a range like 1700-1750)
  // in the same state, or the same intersection — otherwise keep the address as typed.
  const accept = (p: ImportProperty, m: GeocodeMatch) => {
    if (m.state !== p.state) return false;
    const want = p.address.match(/^(\d+)(?:\s*-\s*(\d+))?\b/);
    if (!want) return p.address.includes("&") && m.formatted.includes("&");
    const got = Number(m.address.match(/^(\d+)/)?.[1]);
    const lo = Number(want[1]);
    const hi = want[2] ? Number(want[2]) : lo;
    return got >= lo && got <= hi;
  };
  const todo = [...new Map(prepared.flatMap((d) => d.properties).map((p) => [query(p), p])).entries()].filter(
    ([q]) => !(q in cache),
  );
  // A few at a time — fast, and well inside Google's rate limits.
  for (let i = 0; i < todo.length; i += 5) {
    await Promise.all(
      todo.slice(i, i + 5).map(async ([q, p]) => {
        const res = await geocodeAddress(q);
        if (!res.ok && res.reason !== "no_results") throw new Error(`Google lookup failed: ${res.message}`);
        cache[q] = res.ok ? (res.matches.find((m) => accept(p, m)) ?? null) : null;
      }),
    );
  }
  const lookups = todo.length;
  writeFileSync(cachePath, JSON.stringify(cache, null, 1));
  console.log(`Checked ${lookups} new addresses with Google (cache: ${cachePath}).`);

  // ---- Load, in one transaction ----
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, asEmail));
  if (!user) throw new Error(`No user with email ${asEmail}.`);

  let report: Awaited<ReturnType<typeof importDeals>> | null = null;
  let check: Awaited<ReturnType<typeof importCheck>> | null = null;
  try {
    await db.transaction(async (tx) => {
      report = await importDeals(tx, prepared, {
        byId: user.id,
        geocode: async (p) => cache[query(p)] ?? null,
        renameExisting: answers.renameExisting,
      });
      check = await importCheck(tx, report.imported);
      if (!commit) throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  } finally {
    await pool.end();
  }

  // ---- Report (counts and names only — no money figures) ----
  const r = report!;
  const c = check!;
  const list = (title: string, items: string[]) => {
    console.log(`\n${title}: ${items.length}`);
    for (const i of items) console.log(`  - ${i}`);
  };
  console.log(`\n${commit ? "IMPORTED" : "PRACTICE RUN — nothing saved"}`);
  console.log(`Deals loaded: ${r.imported.length} (closed: ${c.closed}; IOS: ${c.ios} — ${c.iosSales} sales, ${c.iosLeases} leases)`);
  console.log(`Already in the system, skipped: ${r.skippedExisting.length}`);
  console.log(`Properties: ${r.propertiesCreated} new, ${r.propertiesReused} links to an existing property`);
  console.log(`Companies: ${r.companiesCreated.length} new. People: ${r.contactsCreated.length} new.`);
  list("Renamed existing companies", r.companiesRenamed);
  list("New people", r.contactsCreated);
  list("No Google match (saved as typed, flagged for cleanup)", r.unverified);
  list("Size differences on shared properties", r.sizeConflicts);
  list("Warnings", r.warnings.map((w) => `${w.reappsId}: ${w.message}`));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
