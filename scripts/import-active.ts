/**
 * Active-deals import (1.6): loads the deals from Haili's pipeline tracker.
 *
 *   npm run db:import-active -- --deals <active-deals.json>
 *       Practice run: does the whole import inside a transaction, writes a check
 *       workbook next to the JSON, prints the report, then rolls everything back.
 *   ... --commit
 *       Real run: same thing, but keeps it.
 *
 * The JSON comes from Import/active-import-tools/prepare.cjs (tracker + Haili's
 * review sheet answers). Options: --as <email> (default Haili). Addresses are
 * checked with Google once and cached in geocode-cache.json next to the JSON, so a
 * practice run and the real run match exactly. Deals already imported (by tracker
 * row) are skipped, so re-running is safe.
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
  const dealsPath = arg("deals");
  if (!dealsPath) throw new Error("Usage: --deals <active-deals.json> [--commit]");
  const commit = process.argv.includes("--commit");
  const asEmail = arg("as") ?? "haili.rumsey@streamrealty.com";

  const ExcelJS = (await import("exceljs")).default;
  const { Pool } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const { eq } = await import("drizzle-orm");
  const schema = await import("../src/db/schema");
  const { geocodeAddress, reverseGeocode } = await import("../src/server/geocode");
  type GeocodeMatch = import("../src/server/geocode").GeocodeMatch;
  const { activeImportCheck, importActiveDeals } = await import("../src/server/active-import");
  type ActiveImportDeal = import("../src/server/active-import").ActiveImportDeal;
  type ActiveImportProperty = import("../src/server/active-import").ActiveImportProperty;

  const rows: ActiveImportDeal[] = JSON.parse(readFileSync(dealsPath, "utf8")).deals;
  console.log(`Read ${rows.length} deals.`);

  // ---- Google: check every address once, before the database is touched ----
  const cachePath = join(dirname(dealsPath), "geocode-cache.json");
  const cache: Record<string, GeocodeMatch | null> = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
  const query = (p: ActiveImportProperty) =>
    p.pin ? `pin:${p.pin.lat},${p.pin.lng}` : [p.address, p.city, [p.state, p.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  // Accept Google's answer only if it's the same street number (within a range like 1700-1750)
  // in the same state, or the same intersection — otherwise keep the address as typed.
  const accept = (p: ActiveImportProperty, m: GeocodeMatch) => {
    if (p.pin) return true;
    if (m.state !== p.state) return false;
    const address = p.address ?? "";
    const want = address.match(/^(\d+)(?:\s*-\s*(\d+))?\b/);
    if (!want) return address.includes("&") && m.formatted.includes("&");
    const got = Number(m.address.match(/^(\d+)/)?.[1]);
    const lo = Number(want[1]);
    const hi = want[2] ? Number(want[2]) : lo;
    return got >= Math.min(lo, hi) && got <= Math.max(lo, hi);
  };
  const all = rows.flatMap((d) => d.properties).filter((p) => p.address || p.pin);
  const todo = [...new Map(all.map((p) => [query(p), p])).entries()].filter(([q]) => !(q in cache));
  for (let i = 0; i < todo.length; i += 5) {
    await Promise.all(
      todo.slice(i, i + 5).map(async ([q, p]) => {
        const res = p.pin ? await reverseGeocode(p.pin.lat, p.pin.lng) : await geocodeAddress(q);
        if (!res.ok && res.reason !== "no_results") throw new Error(`Google lookup failed: ${res.message}`);
        cache[q] = res.ok ? (res.matches.find((m) => accept(p, m)) ?? null) : null;
      }),
    );
  }
  writeFileSync(cachePath, JSON.stringify(cache, null, 1));
  console.log(`Checked ${todo.length} new addresses with Google (cache: ${cachePath}).`);

  // ---- Load, in one transaction ----
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, asEmail));
  if (!user) throw new Error(`No user with email ${asEmail}.`);

  let report: Awaited<ReturnType<typeof importActiveDeals>> | null = null;
  let check: Awaited<ReturnType<typeof activeImportCheck>> | null = null;
  try {
    await db.transaction(async (tx) => {
      report = await importActiveDeals(tx, rows, {
        byId: user.id,
        geocode: async (p) => ((p.address || p.pin) && cache[query(p)]) || null,
      });
      check = await activeImportCheck(tx);
      if (!commit) throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  } finally {
    await pool.end();
  }
  const r = report!;
  const c = check!;

  // ---- Check workbook for Haili: every property as it will be saved ----
  const wb = new ExcelJS.Workbook();
  const sheet = (name: string, cols: [string, number][]) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = cols.map(([header, width]) => ({ header, width }));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF002F6C" } };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
    return ws;
  };
  const ps = sheet("Properties", [
    ["Tracker row", 9], ["Deal", 32], ["Where the address came from", 26], ["Address as typed", 36], ["Saved as", 32], ["City", 16], ["State", 6],
    ["Google match", 12], ["SF", 12], ["Acres", 8], ["Shared with another deal", 12],
  ]);
  for (const p of r.propertyChecks) {
    const row = ps.addRow([
      p.sourceRow, p.dealName, p.source, p.typed, p.saved, p.city, p.state,
      p.fromPin ? "From pin — check" : p.verified ? "Yes" : "No — check", p.sf, p.acres, p.reused ? "Yes" : "",
    ]);
    if (!p.verified) row.getCell(8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } };
  }
  ps.getColumn(9).numFmt = "#,##0";
  const ds = sheet("Deals", [["Tracker row", 9], ["Deal", 36], ["Stage", 14], ["# properties", 11]]);
  for (const d of r.imported) ds.addRow([d.sourceRow, d.dealName, d.stage, d.properties]);
  const ws = sheet("Warnings", [["Tracker row", 9], ["Deal", 32], ["What to check", 80]]);
  for (const w of r.warnings) ws.addRow([w.sourceRow, w.dealName, w.message]);
  for (const s of r.sizeConflicts) ws.addRow(["", "", `Size difference on a shared building: ${s}`]);
  const ns = sheet("New companies", [["Company", 40]]);
  for (const n of r.companiesCreated) ns.addRow([n]);
  const checkPath = join(dirname(dealsPath), commit ? "Active Import Result.xlsx" : "Active Import Check.xlsx");
  await wb.xlsx.writeFile(checkPath);

  // ---- Report (counts and names only — no money figures) ----
  const list = (title: string, items: string[]) => {
    console.log(`\n${title}: ${items.length}`);
    for (const i of items) console.log(`  - ${i}`);
  };
  console.log(`\n${commit ? "IMPORTED" : "PRACTICE RUN — nothing saved"}`);
  console.log(`Deals loaded: ${r.imported.length}. Tracker deals now in the system by stage: ${JSON.stringify(c.byStage)}`);
  console.log(`Already in the system, skipped: ${r.skippedExisting.length}`);
  console.log(`Properties: ${r.propertiesCreated} new, ${r.propertiesReused} links to an existing property; ${r.ownersSet} given the seller as current owner`);
  console.log(`Companies: ${r.companiesCreated.length} new. People: ${r.contactsCreated.length} new (${r.contactsCreated.join(", ")}).`);
  console.log(`No Google match (saved as typed, flagged for cleanup): ${r.unverified.length}`);
  list("Warnings", r.warnings.map((w) => `row ${w.sourceRow} ${w.dealName}: ${w.message}`));
  list("Size differences on shared properties", r.sizeConflicts);
  console.log(`\nCheck workbook: ${checkPath}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
