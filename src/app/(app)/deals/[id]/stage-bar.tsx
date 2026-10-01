"use client";

import { startTransition, useActionState, useState } from "react";
import { Check } from "lucide-react";
import { inputCls } from "@/components/fields";
import { SearchSelect, type Option } from "@/components/search-select";
import type { Stage } from "@/domain/options";
import { OFF_PIPELINE, PIPELINE, STAGE_DATE, STAGE_HINTS } from "@/domain/stages";
import type { StageState } from "../actions";

type Dates = Partial<Record<"pitchDate" | "wonDate" | "launchDate" | "awardedDate" | "closeDate", string | null>>;

function today() {
  // Local date, not UTC — late-evening moves shouldn't land on tomorrow.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Dynamics-style stage bar. Click any stage to move there — forward, back or
 * skipping; nothing is required. Stages with a date ask for it (today by default),
 * and a pitch lost from BOV 1–2 asks who won it.
 */
export function StageBar({
  stage,
  dates,
  companies,
  locked,
  action,
}: {
  stage: Stage;
  dates: Dates;
  companies: Option[];
  locked: boolean;
  action: (prev: StageState, fd: FormData) => Promise<StageState>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [chosen, setTarget] = useState<Stage | null>(null);
  // Once the move lands, the deal's stage becomes the chosen one and the prompt closes.
  const target = chosen && chosen !== stage ? chosen : null;
  const currentIndex = PIPELINE.indexOf(stage);

  function needsPrompt(s: Stage) {
    const df = STAGE_DATE[s];
    if (df && !dates[df.field]) return true;
    if (s === "Dead/Lost" && (stage === "BOV 1" || stage === "BOV 2")) return true;
    return false;
  }

  function submitMove(fd: FormData) {
    formAction(fd);
  }

  function click(s: Stage) {
    if (locked || s === stage || pending) return;
    if (needsPrompt(s)) return setTarget(s);
    const fd = new FormData();
    fd.set("stage", s);
    // Outside a form, so mark it as a transition for the "Moving…" state to show.
    startTransition(() => formAction(fd));
  }

  const dateInfo = target ? STAGE_DATE[target] : undefined;
  const lostPitch = target === "Dead/Lost" && (stage === "BOV 1" || stage === "BOV 2");

  return (
    <div className="border-b border-border bg-card px-3 py-3 sm:px-5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <ol className="flex min-w-0 overflow-x-auto" aria-label="Stage">
          {PIPELINE.map((s, i) => {
            const isCurrent = s === stage;
            const done = currentIndex >= 0 && i < currentIndex;
            return (
              <li key={s} className="shrink-0">
                <button
                  type="button"
                  onClick={() => click(s)}
                  disabled={locked || pending}
                  title={STAGE_HINTS[s]}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`relative -ml-px flex h-9 items-center gap-1.5 border px-3 text-xs font-semibold transition-colors first:ml-0 first:rounded-l-sm last:rounded-r-sm ${
                    isCurrent
                      ? "z-10 border-navy bg-navy text-white"
                      : done
                        ? "border-border bg-sidebar text-navy hover:bg-hover"
                        : "border-border bg-card text-muted hover:bg-hover hover:text-foreground"
                  } disabled:cursor-default`}
                >
                  {done && <Check size={13} strokeWidth={2.5} />}
                  {s}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="flex shrink-0 gap-2">
          {OFF_PIPELINE.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => click(s)}
              disabled={locked || pending}
              title={STAGE_HINTS[s]}
              className={`h-9 rounded-sm border px-3 text-xs font-semibold ${
                s === stage ? "border-gray-dark bg-gray-dark text-white" : "border-border text-muted hover:bg-hover hover:text-foreground"
              } disabled:cursor-default`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {pending && !target && <p className="mt-2 text-xs text-muted">Moving…</p>}
      {state?.message && <p className="mt-2 text-sm text-danger">{state.message}</p>}

      {target && (
        <form action={submitMove} className="mt-3 flex flex-col gap-3 rounded-sm border border-border bg-background p-3 sm:max-w-xl">
          <input type="hidden" name="stage" value={target} />
          <p className="text-sm font-semibold">
            Move to {target}
            <span className="ml-2 font-normal text-muted">{STAGE_HINTS[target]}</span>
          </p>
          {dateInfo && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">{dateInfo.label}</span>
              <input type="date" name="date" defaultValue={today()} className={`${inputCls} w-48`} />
            </label>
          )}
          {lostPitch && (
            <>
              <SearchSelect
                label="Lost to (optional)"
                name="lostToCompanyId"
                layout="stacked"
                options={companies}
                placeholder="Competitor who won it…"
              />
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">Note (optional)</span>
                <textarea name="lostNote" rows={2} className={inputCls} />
              </label>
            </>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-sm bg-navy px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Moving…" : `Move to ${target}`}
            </button>
            {dateInfo && (
              <button
                type="submit"
                name="skipDate"
                value="1"
                disabled={pending}
                className="text-sm text-muted hover:text-foreground"
                title="Move without recording the date — it will show as missing"
              >
                Skip date
              </button>
            )}
            <button type="button" onClick={() => setTarget(null)} className="text-sm text-muted hover:text-foreground">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
