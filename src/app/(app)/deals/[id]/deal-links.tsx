"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useConfirm } from "@/components/confirm-dialog";
import { SearchSelect, type Option } from "@/components/search-select";
import type { LinkState } from "../actions";

const smallBtn = "rounded-sm border border-navy px-3 py-1.5 text-sm font-semibold text-navy hover:bg-hover disabled:opacity-50";
const linkBtn = "text-xs text-link hover:underline disabled:opacity-50";

/** Submit button that asks first, using the branded confirm dialog. */
function ConfirmSubmit({
  label,
  pendingLabel,
  className,
  ask,
}: {
  label: string;
  pendingLabel: string;
  className: string;
  ask: () => { title: string; message: string; items?: string[]; confirmLabel: string } | null;
}) {
  const { pending } = useFormStatus();
  const [confirm, dialog] = useConfirm();
  const confirmed = useRef(false);
  return (
    <>
      {dialog}
      <button
        type="submit"
        disabled={pending}
        className={className}
        onClick={async (e) => {
          if (confirmed.current) {
            confirmed.current = false;
            return;
          }
          e.preventDefault();
          const form = e.currentTarget.form;
          const opts = ask();
          // Nothing to confirm (e.g. no deal picked yet): let the server say what's missing.
          if (!opts || (await confirm(opts))) {
            if (!form) return;
            confirmed.current = true;
            form.requestSubmit();
          }
        }}
      >
        {pending ? pendingLabel : label}
      </button>
    </>
  );
}

/** "Break out" on a property row: the property moves to a new deal of its own. */
export function BreakOutButton({
  action,
  dealName,
  propertyLabel,
}: {
  action: (prev: LinkState) => Promise<LinkState>;
  dealName: string;
  propertyLabel: string;
}) {
  const [state, formAction] = useActionState(action, { message: null });
  return (
    <form action={formAction} className="inline">
      <ConfirmSubmit
        label="Break out"
        pendingLabel="Breaking out…"
        className={linkBtn}
        ask={() => ({
          title: `Break out ${propertyLabel}?`,
          message: `This creates a new deal for this property and takes it off "${dealName}".`,
          items: [
            "The new deal copies the seller, deal team, type, stage and dates.",
            "Prices aren't copied — add the new deal's own pricing.",
            "The two deals are linked to each other.",
          ],
          confirmLabel: "Break out",
        })}
      />
      {state.message && <span className="ml-2 text-xs text-danger">{state.message}</span>}
    </form>
  );
}

/**
 * "Combine with…": pick another deal and which of the two stays active. The other one's
 * properties, parties and team move onto the one that stays, and it goes to Dead.
 */
export function CombineForm({
  action,
  dealName,
  options,
}: {
  action: (prev: LinkState, fd: FormData) => Promise<LinkState>;
  dealName: string;
  options: Option[];
}) {
  const [state, formAction] = useActionState(action, { message: null });
  const [chosen, setChosen] = useState<Option | null>(null);
  const [keep, setKeep] = useState<"this" | "other" | null>(null);
  const keepName = keep === "this" ? dealName : chosen?.name;
  const foldName = keep === "this" ? chosen?.name : dealName;
  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-sm border border-dashed border-gray p-3">
      <SearchSelect
        name="otherDealId"
        label="Combine with another deal"
        layout="stacked"
        options={options}
        placeholder="Search by deal name…"
        onChange={(id) => setChosen(options.find((o) => o.id === id) ?? null)}
      />
      <fieldset className="flex flex-col gap-1.5 text-sm">
        <legend className="mb-1 font-semibold">Which deal stays active?</legend>
        <label className="flex items-baseline gap-2">
          <input type="radio" name="keep" value="this" checked={keep === "this"} onChange={() => setKeep("this")} />
          <span>
            This deal — <span className="font-semibold">{dealName}</span>
          </span>
        </label>
        <label className="flex items-baseline gap-2">
          <input type="radio" name="keep" value="other" checked={keep === "other"} onChange={() => setKeep("other")} />
          <span>
            The deal picked above{chosen ? <> — <span className="font-semibold">{chosen.name}</span></> : ""}
          </span>
        </label>
        <p className="text-xs text-muted">The deal that stays keeps its own prices, stage and dates. The other goes to Dead.</p>
      </fieldset>
      <div>
        <ConfirmSubmit
          label="Combine"
          pendingLabel="Combining…"
          className={smallBtn}
          ask={() =>
            chosen && keep
              ? {
                  title: `Keep "${keepName}" and combine "${foldName}" into it?`,
                  message: `"${foldName}"'s properties, parties and team move onto "${keepName}".`,
                  items: [
                    `"${keepName}" keeps its own prices, stage and dates.`,
                    `"${foldName}" goes to Dead with the note "Combined into ${keepName}" — it isn't deleted.`,
                    "The two deals are linked to each other.",
                  ],
                  confirmLabel: "Combine",
                }
              : null
          }
        />
      </div>
      {state.message && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
