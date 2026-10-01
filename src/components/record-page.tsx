"use client";

import { createContext, useActionState, useContext, useState } from "react";
import { Archive, ArchiveRestore, Save, Trash2 } from "lucide-react";
import { archiveAction, deleteAction, type DeleteState } from "@/app/(app)/housekeeping-actions";
import type { EntityKind } from "@/server/housekeeping";
import { CommandButton } from "./command-buttons";

export type SaveState = { ok: boolean; message: string } | null;
type SaveAction = (prev: SaveState, fd: FormData) => Promise<SaveState>;

const FORM_ID = "record-form";

type Ctx = { formAction: (fd: FormData) => void; pending: boolean; state: SaveState };
const RecordFormContext = createContext<Ctx | null>(null);

/**
 * Holds the record's main form so the command bar's Save button (which sits
 * outside the form, as in Dynamics) can submit it and show progress.
 */
export function RecordFormProvider({ action, children }: { action: SaveAction; children: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(action, null);
  return <RecordFormContext.Provider value={{ state, formAction, pending }}>{children}</RecordFormContext.Provider>;
}

function useRecordForm() {
  const ctx = useContext(RecordFormContext);
  if (!ctx) throw new Error("RecordFormProvider missing");
  return ctx;
}

export function MainForm({ children, readOnly }: { children: React.ReactNode; readOnly?: boolean }) {
  const { formAction } = useRecordForm();
  return (
    <form id={FORM_ID} action={formAction} className="flex flex-col gap-4">
      {/* A disabled fieldset makes every field inside read-only in one go. */}
      <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4">
        {children}
      </fieldset>
      {/* Lets Enter-to-submit work from any field. */}
      <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
    </form>
  );
}

export function SaveCommand({ label = "Save" }: { label?: string }) {
  const { pending, state } = useRecordForm();
  return (
    <>
      <button
        type="submit"
        form={FORM_ID}
        disabled={pending}
        className="flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 text-sm hover:bg-hover disabled:opacity-50"
      >
        <Save size={16} strokeWidth={1.75} className="text-navy" />
        {pending ? "Saving…" : label}
      </button>
      {state && !pending && (
        <span role="status" className={`shrink-0 px-2 text-sm ${state.ok ? "text-muted" : "text-danger"}`}>
          {state.message}
        </span>
      )}
    </>
  );
}

/** Archive (anyone) and Delete (the three admins) as command-bar buttons. */
export function HousekeepingCommands({
  kind,
  id,
  archivedAt,
  canDelete,
}: {
  kind: EntityKind;
  id: string;
  archivedAt: Date | null;
  canDelete: boolean;
}) {
  const [delState, del, deleting] = useActionState<DeleteState, FormData>(deleteAction, null);
  return (
    <>
      <form action={archiveAction} className="contents">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="archived" value={String(!archivedAt)} />
        <CommandButton type="submit" icon={archivedAt ? ArchiveRestore : Archive}>
          {archivedAt ? "Unarchive" : "Archive"}
        </CommandButton>
      </form>
      {canDelete && (
        <form
          action={del}
          className="contents"
          onSubmit={(e) => {
            if (!confirm("Permanently delete this record? This can't be undone. Use Archive for housekeeping.")) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <CommandButton type="submit" icon={Trash2} danger disabled={deleting}>
            Delete
          </CommandButton>
        </form>
      )}
      {delState?.message && <span className="shrink-0 px-2 text-sm text-danger">{delState.message}</span>}
    </>
  );
}

export type Fact = { label: string; value: React.ReactNode };

/** Record title with key facts across the top, as in a Dynamics form header. */
export function RecordHeader({
  kindLabel,
  title,
  subtitle,
  facts = [],
  flags,
}: {
  kindLabel: string;
  title: string;
  subtitle?: React.ReactNode;
  facts?: Fact[];
  flags?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border bg-card px-4 py-4 sm:px-5">
      <div className="min-w-0">
        <h1 className="font-serif text-xl leading-snug break-words">{title}</h1>
        <p className="mt-0.5 text-sm text-muted">
          {kindLabel}
          {subtitle && <> · {subtitle}</>}
        </p>
        {flags && <div className="mt-1.5 flex flex-wrap gap-3">{flags}</div>}
      </div>
      {facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:flex sm:flex-wrap sm:gap-y-2">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0 sm:max-w-72 sm:border-l sm:border-border sm:pl-4 sm:first:border-0 sm:first:pl-0">
              <dd className="truncate font-semibold" title={typeof f.value === "string" ? f.value : undefined}>
                {f.value || "—"}
              </dd>
              <dt className="text-xs text-muted">{f.label}</dt>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export type Tab = { id: string; label: string; content: React.ReactNode };

/** Tabs under the header. Every panel stays mounted so unsaved edits survive switching. */
export function Tabs({ tabs, initial }: { tabs: Tab[]; initial?: string }) {
  const [active, setActive] = useState(initial && tabs.some((t) => t.id === initial) ? initial : tabs[0].id);
  return (
    <>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border bg-card px-3 sm:px-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={`relative shrink-0 px-3 py-2.5 text-sm ${
              active === t.id ? "font-semibold text-navy" : "text-foreground hover:text-navy"
            }`}
          >
            {t.label}
            {active === t.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded bg-navy" />}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={active !== t.id} className="flex flex-col gap-4 p-3 sm:p-5">
          {t.content}
        </div>
      ))}
    </>
  );
}

function formatWhen(d: Date) {
  // Fixed time zone so the server (UTC on Vercel) and the browser render the same text.
  return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Chicago" });
}

export function ModifiedStamp({ at, by }: { at: Date; by: string | null }) {
  return (
    <p className="px-1 text-xs text-muted">
      Last modified {formatWhen(at)}
      {by && ` by ${by}`}
    </p>
  );
}
