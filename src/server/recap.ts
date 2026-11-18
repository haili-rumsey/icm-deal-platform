import "server-only";
import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { bids, changeLog, companies, contacts, deals, notes, users } from "@/db/schema";
import { attribution } from "@/domain/notes";
import { dealValue, formatMoney } from "@/domain/stages";

/**
 * The weekly recap (PRD §6, milestone 2.4): what moved in the previous seven days plus the
 * day it sends, so someone who missed the meeting can reconstruct it from the email alone.
 * Seven sections, in the PRD's order. Archived deals (e.g. a deal merged away by Combine)
 * never appear.
 */

const TZ = "America/Chicago";
const PARKED = ["Track", "Dead", "Lost"] as const;

export type RecapSection = { title: string; lines: string[] };
export type Recap = { subject: string; rangeLabel: string; sections: RecapSection[] };

// ---- Dates (Central time, the way the team reads them) ----

function centralParts(d: Date) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const [y, m, day] = p.split("-").map(Number);
  return { y, m, d: day };
}

/** The moment a given Central calendar day begins (handles daylight saving). */
function centralMidnight(y: number, m: number, d: number): Date {
  let t = Date.UTC(y, m - 1, d, 6); // 6:00 UTC is midnight in winter (CST)
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(new Date(t))) % 24;
  if (hour === 1) t -= 60 * 60 * 1000; // summer (CDT): midnight is 5:00 UTC
  return new Date(t);
}

/** The start of the recap window: the beginning of the day seven days before `now`, Central. */
export function windowStart(now: Date): { start: Date; startDate: string; endDate: string } {
  const today = centralParts(now);
  const back = new Date(Date.UTC(today.y, today.m - 1, today.d - 7));
  const s = { y: back.getUTCFullYear(), m: back.getUTCMonth() + 1, d: back.getUTCDate() };
  const iso = (p: { y: number; m: number; d: number }) => `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
  return { start: centralMidnight(s.y, s.m, s.d), startDate: iso(s), endDate: iso(today) };
}

const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" });
const dayWithYear = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", year: "numeric" });
const fmtDay = (d: Date) => dayFmt.format(d);

/** "2026-11-12" → "Nov 12" (a date with no time, so no time-zone shift). */
function fmtDateOnly(v: string | null): string {
  if (!v) return "no date";
  const [y, m, d] = v.split("-").map(Number);
  return dayFmt.format(new Date(Date.UTC(y, m - 1, d, 12)));
}

const clip = (s: string, n = 180) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const money = (v: string | number | null) => (v === null || v === "" ? null : formatMoney(Number(v), true));

// ---- The recap ----

export async function buildRecap(now = new Date()): Promise<Recap> {
  const { start, startDate, endDate } = windowStart(now);
  const rangeLabel = `${dayFmt.format(start)} – ${dayWithYear.format(now)}`;
  const author = alias(contacts, "author");
  const enteredBy = alias(users, "entered_by");

  const [moves, created, awardedRows, fellOutRows, bidRows, closedRows, noteRows] = await Promise.all([
    // 1 + 6. Stage moves (change log). Parked moves get their own section.
    db
      .select({
        dealName: deals.dealName,
        from: changeLog.fromStage,
        to: changeLog.toStage,
        at: changeLog.occurredAt,
        byName: users.name,
        byEmail: users.email,
        deadNote: deals.deadNote,
        lostNote: deals.lostNote,
        followUpDate: deals.followUpDate,
      })
      .from(changeLog)
      .innerJoin(deals, eq(deals.id, changeLog.recordId))
      .leftJoin(users, eq(users.id, changeLog.byUserId))
      .where(and(eq(changeLog.kind, "stage_change"), eq(changeLog.recordType, "deal"), gte(changeLog.occurredAt, start), isNull(deals.archivedAt)))
      .orderBy(asc(changeLog.occurredAt)),

    // 2. New deals.
    db
      .select({ dealName: deals.dealName, stage: deals.stage, at: changeLog.occurredAt, byName: users.name, byEmail: users.email })
      .from(changeLog)
      .innerJoin(deals, eq(deals.id, changeLog.recordId))
      .leftJoin(users, eq(users.id, changeLog.byUserId))
      .where(and(eq(changeLog.kind, "created"), eq(changeLog.recordType, "deal"), gte(changeLog.occurredAt, start), isNull(deals.archivedAt)))
      .orderBy(asc(changeLog.occurredAt)),

    // 3a. Awards. A bid has no "awarded on" date of its own, so this uses when the awarded bid was
    // last saved — an award edited later in the week can show up again.
    db
      .select({ dealName: deals.dealName, company: companies.name, amount: bids.bidAmount })
      .from(bids)
      .innerJoin(deals, eq(deals.id, bids.dealId))
      .innerJoin(companies, eq(companies.id, bids.companyId))
      .where(and(eq(bids.isAwarded, true), eq(bids.fellOut, false), gte(bids.lastModifiedAt, start), isNull(deals.archivedAt)))
      .orderBy(asc(bids.lastModifiedAt)),

    // 3b. Fell-outs (by their fell-out date).
    db
      .select({ dealName: deals.dealName, company: companies.name, date: bids.fellOutDate, note: bids.fellOutNote })
      .from(bids)
      .innerJoin(deals, eq(deals.id, bids.dealId))
      .innerJoin(companies, eq(companies.id, bids.companyId))
      .where(and(eq(bids.fellOut, true), gte(bids.fellOutDate, startDate), lte(bids.fellOutDate, endDate), isNull(deals.archivedAt)))
      .orderBy(asc(bids.fellOutDate)),

    // 4. Bids received.
    db
      .select({
        dealName: deals.dealName,
        company: companies.name,
        amount: bids.bidAmount,
        round: bids.bidRound,
        verbal: bids.isVerbal,
      })
      .from(bids)
      .innerJoin(deals, eq(deals.id, bids.dealId))
      .innerJoin(companies, eq(companies.id, bids.companyId))
      .where(and(gte(bids.createdAt, start), isNull(deals.archivedAt)))
      .orderBy(asc(deals.dealName), desc(bids.bidAmount)),

    // 5. Closed deals, by close date.
    db
      .select({
        dealName: deals.dealName,
        closeDate: deals.closeDate,
        dealType: deals.dealType,
        stage: deals.stage,
        bovPriceMid: deals.bovPriceMid,
        guidancePrice: deals.guidancePrice,
        closedPrice: deals.closedPrice,
        totalCapitalization: deals.totalCapitalization,
        loanAmount: deals.loanAmount,
        totalLeaseConsideration: deals.totalLeaseConsideration,
        totalCommission: deals.totalCommission,
        inHouseGross: deals.inHouseGross,
      })
      .from(deals)
      .where(and(eq(deals.stage, "Closed"), gte(deals.closeDate, startDate), lte(deals.closeDate, endDate), isNull(deals.archivedAt)))
      .orderBy(asc(deals.closeDate)),

    // 7. Notes logged, with author.
    db
      .select({
        at: notes.loggedAt,
        company: companies.name,
        dealName: deals.dealName,
        subject: notes.subject,
        body: notes.body,
        authorFirst: author.firstName,
        authorLast: author.lastName,
        enteredByName: enteredBy.name,
      })
      .from(notes)
      .innerJoin(companies, eq(companies.id, notes.companyId))
      .leftJoin(deals, eq(deals.id, notes.dealId))
      .leftJoin(author, eq(author.id, notes.authorId))
      .leftJoin(enteredBy, eq(enteredBy.id, notes.enteredById))
      .where(gte(notes.loggedAt, start))
      .orderBy(asc(notes.loggedAt)),
  ]);

  const who = (name: string | null, email: string | null) => name ?? email ?? "someone";
  const isParked = (s: string | null) => !!s && (PARKED as readonly string[]).includes(s);

  const stageMoves = moves
    .filter((m) => !isParked(m.to))
    .map((m) => `${m.dealName}: ${m.from} → ${m.to} (${who(m.byName, m.byEmail)}, ${fmtDay(m.at)})`);

  const newDeals = created.map((c) => `${c.dealName} — added at ${c.stage} by ${who(c.byName, c.byEmail)}, ${fmtDay(c.at)}`);

  const awardLines = [
    ...awardedRows.map((a) => `${a.dealName}: awarded to ${a.company}${money(a.amount) ? ` at ${money(a.amount)}` : ""}`),
    ...fellOutRows.map(
      (f) => `${f.dealName}: ${f.company}'s awarded bid FELL OUT (${fmtDateOnly(f.date)})${f.note ? ` — ${clip(f.note)}` : ""}`,
    ),
  ];

  const bidLines = bidRows.map((b) => {
    const bits = [b.round, b.verbal ? "verbal" : null].filter(Boolean).join(", ");
    return `${b.dealName}: ${b.company}${money(b.amount) ? ` — ${money(b.amount)}` : ""}${bits ? ` (${bits})` : ""}`;
  });

  const closedLines = closedRows.map((c) => {
    const v = dealValue({ ...c, stage: c.stage });
    const bits = [money(v.value) ? `${v.source.toLowerCase()} ${money(v.value)}` : null, money(c.totalCommission) ? `fee ${money(c.totalCommission)}` : null]
      .filter(Boolean)
      .join(" · ");
    return `${c.dealName} — closed ${fmtDateOnly(c.closeDate)}${bits ? ` · ${bits}` : ""}`;
  });

  const parkedLines = moves
    .filter((m) => isParked(m.to))
    .map((m) => {
      const note = m.to === "Dead" ? m.deadNote : m.to === "Lost" ? m.lostNote : m.followUpDate ? `follow up ${fmtDateOnly(m.followUpDate)}` : null;
      return `${m.dealName}: moved to ${m.to} from ${m.from} (${who(m.byName, m.byEmail)}, ${fmtDay(m.at)})${note ? ` — ${clip(note)}` : ""}`;
    });

  const noteLines = noteRows.map((n) => {
    const authorName = n.authorFirst ? `${n.authorFirst} ${n.authorLast ?? ""}`.trim() : null;
    const head = [n.company, n.dealName ? `re: ${n.dealName}` : null, n.subject].filter(Boolean).join(" — ");
    return `${head} (${attribution({ authorName, enteredByName: n.enteredByName })}, ${fmtDay(n.at)}): ${clip(n.body)}`;
  });

  return {
    subject: `ICM weekly recap — ${rangeLabel}`,
    rangeLabel,
    sections: [
      { title: "Stage moves", lines: stageMoves },
      { title: "New deals", lines: newDeals },
      { title: "Awards and fell-outs", lines: awardLines },
      { title: "Bids received", lines: bidLines },
      { title: "Closed deals", lines: closedLines },
      { title: "Dead and dormant", lines: parkedLines },
      { title: "Notes logged", lines: noteLines },
    ],
  };
}

// ---- Layout ----

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function recapText(r: Recap): string {
  const body = r.sections
    .map((s) => `${s.title.toUpperCase()} (${s.lines.length})\n${s.lines.length ? s.lines.map((l) => `- ${l}`).join("\n") : "Nothing this week."}`)
    .join("\n\n");
  return `ICM weekly recap\n${r.rangeLabel}\n\n${body}\n`;
}

export function recapHtml(r: Recap): string {
  const sections = r.sections
    .map(
      (s) => `<h3 style="margin:22px 0 6px;font-size:15px;color:#002F6C">${esc(s.title)} <span style="color:#777;font-weight:normal">(${s.lines.length})</span></h3>${
        s.lines.length
          ? `<ul style="margin:0;padding-left:20px">${s.lines.map((l) => `<li style="margin:3px 0">${esc(l)}</li>`).join("")}</ul>`
          : `<p style="margin:0;color:#777">Nothing this week.</p>`
      }`,
    )
    .join("");
  return `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#111;max-width:720px"><h2 style="margin:0;color:#002F6C">ICM weekly recap</h2><p style="margin:2px 0 0;color:#555">${esc(r.rangeLabel)}</p>${sections}</div>`;
}
