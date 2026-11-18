import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobRuns } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { buildRecap, recapHtml, recapText } from "@/server/recap";

export const dynamic = "force-dynamic";

/**
 * The weekly recap (milestone 2.4). Vercel Cron calls this on Friday mornings (vercel.json),
 * after the Tuesday and Thursday meetings. Covers the previous seven days plus today.
 * Same safeguards as the daily check: needs CRON_SECRET, and every run is written to job_runs.
 *
 * Recipients: JOB_TEST_EMAIL (comma-separated allowed) while Resend is in test mode. Switch to
 * the ICM team roster once a sending domain is verified.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [run] = await db.insert(jobRuns).values({ job: "weekly-recap" }).returning({ id: jobRuns.id });
  const finish = (status: "ok" | "failed", detail: string) =>
    db.update(jobRuns).set({ status, detail, finishedAt: new Date() }).where(eq(jobRuns.id, run.id));

  try {
    const to = (process.env.JOB_TEST_EMAIL ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!to.length) throw new Error("JOB_TEST_EMAIL is not set, so there is nobody to email.");

    const recap = await buildRecap();
    await sendEmail({ to, subject: recap.subject, text: recapText(recap), html: recapHtml(recap) });

    const detail = recap.sections.map((s) => `${s.title}: ${s.lines.length}`).join("; ");
    await finish("ok", detail);
    return Response.json({ ok: true, detail });
  } catch (e) {
    await finish("failed", e instanceof Error ? e.message : "Unknown error");
    return new Response("Job failed", { status: 500 });
  }
}
