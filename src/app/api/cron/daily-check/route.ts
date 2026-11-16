import { eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { changeLog, jobRuns } from "@/db/schema";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * The 2.3 proof that scheduled work runs and mail gets delivered. Vercel Cron calls this
 * once a day (see vercel.json). It writes a row to job_runs, then emails a short note
 * saying it ran and what the change log caught in the last 24 hours.
 *
 * Replace or remove once the weekly recap (2.4) and alerts (2.5) are running on the
 * same plumbing.
 */
export async function GET(request: Request) {
  // Vercel sends "Authorization: Bearer <CRON_SECRET>". Without it, anyone could trigger this.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [run] = await db.insert(jobRuns).values({ job: "daily-check" }).returning({ id: jobRuns.id });
  const finish = (status: "ok" | "failed", detail: string) =>
    db.update(jobRuns).set({ status, detail, finishedAt: new Date() }).where(eq(jobRuns.id, run.id));

  try {
    const to = process.env.JOB_TEST_EMAIL;
    if (!to) throw new Error("JOB_TEST_EMAIL is not set, so there is nobody to email.");

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await db
      .select({ kind: changeLog.kind, n: sql<number>`count(*)::int` })
      .from(changeLog)
      .where(gte(changeLog.occurredAt, since))
      .groupBy(changeLog.kind);
    const count = (k: string) => rows.find((r) => r.kind === k)?.n ?? 0;
    const moves = count("stage_change");
    const created = count("created");

    const when = new Date().toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" });
    const summary = `Change log, last 24 hours: ${moves} stage move${moves === 1 ? "" : "s"}, ${created} new record${created === 1 ? "" : "s"}.`;
    await sendEmail({
      to,
      subject: "ICM Deal Platform: scheduled job ran",
      text: `The daily scheduled job ran on ${when} (Central).\n\n${summary}\n\nThis is the milestone 2.3 test message. It will be replaced by the weekly recap.`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111"><p>The daily scheduled job ran on <b>${when}</b> (Central).</p><p>${summary}</p><p style="color:#555;font-size:13px">This is the milestone 2.3 test message. It will be replaced by the weekly recap.</p></div>`,
    });

    await finish("ok", summary);
    return Response.json({ ok: true, summary });
  } catch (e) {
    await finish("failed", e instanceof Error ? e.message : "Unknown error");
    return new Response("Job failed", { status: 500 });
  }
}
