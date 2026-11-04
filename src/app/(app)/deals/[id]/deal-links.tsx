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

/** "Combine with…": the chosen deal is folded into this one and goes to Dead. */
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
  return (
    <form
      action={formAction}
      className="grid grid-cols-1 items-end gap-3 rounded-sm border border-dashed border-gray p-3 sm:grid-cols-[1fr_auto]"
    >
      <SearchSelect
        name="otherDealId"
        label="Combine another deal into this one"
        layout="stacked"
        options={options}
        placeholder="Search by deal name…"
        onChange={(id) => setChosen(options.find((o) => o.id === id) ?? null)}
      />
      <ConfirmSubmit
        label="Combine"
        pendingLabel="Combining…"
        className={smallBtn}
        ask={() =>
          chosen && {
            title: `Combine "${chosen.name}" into this deal?`,
            message: `Its properties, parties and team move onto "${dealName}".`,
            items: [
              `This deal's prices are kept.`,
              `"${chosen.name}" goes to Dead with the note "Combined into ${dealName}" — it isn't deleted.`,
              "The two deals are linked to each other.",
            ],
            confirmLabel: "Combine",
          }
        }
      />
      {state.message && <p className="text-sm text-danger sm:col-span-2">{state.message}</p>}
    </form>
  );
}
