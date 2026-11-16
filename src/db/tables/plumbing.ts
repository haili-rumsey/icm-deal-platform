import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

const stamp = (name: string) => timestamp(name, { mode: "date", withTimezone: true });

/**
 * The change log (PRD §1): deliberately narrow — stage moves (from, to, when, who) and
 * record creation. Not a full audit table. It exists to feed the weekly recap (2.4).
 *
 * Rows are written by database triggers (see the migration), not by app code, so every
 * route that changes a stage or creates a record is covered — including bid awards,
 * fell-outs, Break out / Combine and imports.
 */
export const changeLog = pgTable(
  "change_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // "created" | "stage_change"
    kind: text("kind").notNull(),
    // "deal" | "property" | "company" | "contact"
    recordType: text("record_type").notNull(),
    // Not a foreign key: the log outlives a record deleted in error.
    recordId: uuid("record_id").notNull(),
    fromStage: text("from_stage"),
    toStage: text("to_stage"),
    byUserId: text("by_user_id").references(() => users.id),
    occurredAt: stamp("occurred_at").notNull().defaultNow(),
  },
  (t) => [index("change_log_occurred_idx").on(t.occurredAt), index("change_log_record_idx").on(t.recordType, t.recordId)],
);

/** One row per scheduled-job run (Vercel Cron), so "did it fire?" has an answer. */
export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    job: text("job").notNull(),
    startedAt: stamp("started_at").notNull().defaultNow(),
    finishedAt: stamp("finished_at"),
    // "running" | "ok" | "failed"
    status: text("status").notNull().default("running"),
    detail: text("detail"),
  },
  (t) => [index("job_runs_started_idx").on(t.startedAt)],
);
