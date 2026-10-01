"use client";

import { startTransition, useActionState, useState } from "react";
import { Check } from "lucide-react";
import { inputCls } from "@/components/fields";
import { useUnsavedChanges } from "@/components/record-page";
import { SearchSelect, type Option } from "@/components/search-select";
import type { Stage } from "@/domain/options";
import { OFF_PIPELINE, PIPELINE, STAGE_DATE, STAGE_HINTS } from "@/domain/stages";
import type { StageState } from "../actions";

type Dates = Partial<Record<"pitchDate" | "wonDate" | "launchDate" | "awardedDate" | "closeDate", string | null>>;

/** Arrow shape: notched on the left (except the first), pointed on the right (except the last). */
function chevron(first: boolean, last: boolean) {
  const t = "14px";
  if (first) return `polygon(0 0, calc(100% - ${t}) 0, 100% 50%, calc(100% - ${t}) 100%, 0 100%)`;
  if (last) return `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${t} 50%)`;
  return `polygon(0 0, calc(100% - ${t}) 0, 100% 50%, calc(100% - ${t}) 100%, 0 100%, ${t} 50%)`;
}

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
  const unsaved = useUnsavedChanges();

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
    if (
      unsaved &&
      !confirm(
        "You have unsaved changes on this deal. Moving the stage will discard them.\n\nOK — move anyway\nCancel — stay and Save first",
      )
    ) {
      return;
    }
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
      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
        {/* Chevrons stretch across the row; on narrow screens they keep a readable width and scroll. */}
        <ol className="flex min-w-0 flex-1 overflow-x-auto pb-0.5" aria-label="Stage">
          {PIPELINE.map((s, i) => {
            const isCurrent = s === stage;
            const done = currentIndex >= 0 && i < currentIndex;
            const first = i === 0;
            const last = i === PIPELINE.length - 1;
            return (
              <li key={s} className={`min-w-[7.5rem] flex-auto ${first ? "" : "-ml-2.5"}`}>
                <button
                  type="button"
                  onClick={() => click(s)}
                  disabled={locked || pending}
                  title={STAGE_HINTS[s]}
                  aria-current={isCurrent ? "step" : undefined}
                  style={{ clipPath: chevron(first, last) }}
                  className={`flex h-11 w-full items-center justify-center gap-1.5 text-xs font-semibold transition-colors sm:text-sm ${
                    first ? "pl-3 pr-5" : last ? "pl-6 pr-3" : "pl-6 pr-5"
                  } ${
                    isCurrent
                      ? "bg-blue text-white"
                      : done
                        ? "bg-gray text-foreground hover:brightness-95"
                        : "bg-gray-light text-gray-dark hover:brightness-95"
                  } disabled:cursor-default disabled:hover:brightness-100`}
                >
                  {done && <Check size={14} strokeWidth={2.75} className="shrink-0" />}
                  <span className="truncate">{s}</span>
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
              className={`h-11 flex-1 rounded-sm border px-4 text-xs font-semibold sm:text-sm lg:flex-none ${
                s === stage ? "border-gray-dark bg-gray-dark text-white" : "border-border bg-card text-gray-dark hover:bg-hover"
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
