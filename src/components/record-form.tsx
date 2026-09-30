"use client";

import { useActionState } from "react";

export type SaveState = { ok: boolean; message: string } | null;

/** A form bound to a server action that can report a message back (e.g. "Saved"). */
export function RecordForm({
  action,
  children,
  submitLabel = "Save",
}: {
  action: (prev: SaveState, fd: FormData) => Promise<SaveState>;
  children: React.ReactNode;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {children}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {state && <span className={`text-sm ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</span>}
      </div>
    </form>
  );
}
