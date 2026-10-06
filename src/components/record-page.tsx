"use client";

import { useRouter } from "next/navigation";
import { createContext, useActionState, useContext, useEffect, useRef, useState } from "react";
import { Archive, ArchiveRestore, ArrowLeft, Save, Trash2 } from "lucide-react";
import { archiveAction, deleteAction, type DeleteState } from "@/app/(app)/housekeeping-actions";
import type { EntityKind } from "@/server/housekeeping";
import { CommandButton } from "./command-buttons";
import { useConfirm } from "./confirm-dialog";

export type SaveState = { ok: boolean; message: string } | null;
type SaveAction = (prev: SaveState, fd: FormData) => Promise<SaveState>;

const FORM_ID = "record-form";

type Ctx = {
  formAction: (fd: FormData) => void;
  pending: boolean;
  state: SaveState;
  dirty: boolean;
  setDirty: (d: boolean) => void;
};
const RecordFormContext = createContext<Ctx | null>(null);

/**
 * Holds the record's main form so the command bar's Save button (which sits
 * outside the form, as in Dynamics) can submit it and show progress.
 */
export function RecordFormProvider({ action, children }: { action: SaveAction; children: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [dirty, setDirty] = useState(false);
  return (
    <RecordFormContext.Provider value={{ state, formAction, pending, dirty, setDirty }}>{children}</RecordFormContext.Provider>
  );
}

/** True while the record's main form has changes that haven't been saved. Safe outside a provider. */
export function useUnsavedChanges() {
  return useContext(RecordFormContext)?.dirty ?? false;
}

function serialize(form: HTMLFormElement) {
  return JSON.stringify([...new FormData(form).entries()].map(([k, v]) => [k, String(v)]));
}

function useRecordForm() {
  const ctx = useContext(RecordFormContext);
  if (!ctx) throw new Error("RecordFormProvider missing");
  return ctx;
}

export function MainForm({ children, readOnly }: { children: React.ReactNode; readOnly?: boolean }) {
  const { formAction, dirty, setDirty } = useRecordForm();
  const ref = useRef<HTMLFormElement>(null);
  const snapshot = useRef<string | null>(null);

  // What the form looked like when it loaded. A remount (after a save or a stage
  // move) takes a fresh snapshot, so it starts clean again.
  useEffect(() => {
    if (ref.current) snapshot.current = serialize(ref.current);
    setDirty(false);
  }, [setDirty]);

  // Warn before closing the tab or reloading with unsaved changes (the browser draws that box).
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Links inside the app (sidebar, names, breadcrumbs) get our own box instead.
  const router = useRouter();
  const [confirmLeave, leaveDialog] = useConfirm();
  useEffect(() => {
    if (!dirty) return;
    const onClick = async (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      const leave = await confirmLeave({
        title: "Unsaved changes",
        message: "You've changed this record without saving. Leaving this page will discard those changes. To keep them, cancel and click Save first.",
        confirmLabel: "Leave without saving",
        cancelLabel: "Cancel",
      });
      if (leave) {
        setDirty(false);
        router.push(url.pathname + url.search);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty, confirmLeave, router, setDirty]);

  // Compare after React has applied the change (pickers update hidden fields on click).
  function check() {
    setTimeout(() => {
      if (ref.current && snapshot.current !== null) setDirty(serialize(ref.current) !== snapshot.current);
    }, 0);
  }

  return (
    <form
      ref={ref}
      id={FORM_ID}
      action={formAction}
      onInput={check}
      onChange={check}
      onClick={check}
      className="flex flex-col gap-4"
    >
      {leaveDialog}
      {/* A disabled fieldset makes every field inside read-only in one go. */}
      <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4">
        {children}
      </fieldset>
      {/* Lets Enter-to-submit work from any field. */}
      <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
    </form>
  );
}

/**
 * Back arrow at the left of the command bar: returns to the previous page, or to
 * `fallbackHref` (the record's list) when this page was opened directly. Asks first
 * if there are unsaved changes, like any other in-app link. Also used on lists,
 * reports and admin screens, which have no record form to protect.
 */
export function BackCommand({ fallbackHref }: { fallbackHref: string }) {
  const form = useContext(RecordFormContext);
  const dirty = form?.dirty ?? false;
  const router = useRouter();
  const [confirmLeave, leaveDialog] = useConfirm();
  async function goBack() {
    if (dirty) {
      const leave = await confirmLeave({
        title: "Unsaved changes",
        message: "You've changed this record without saving. Leaving this page will discard those changes. To keep them, cancel and click Save first.",
        confirmLabel: "Leave without saving",
        cancelLabel: "Cancel",
      });
      if (!leave) return;
      form?.setDirty(false);
    }
    if (window.history.length > 1) router.back();
    else router.push(fallbackHref);
  }
  return (
    <>
      {leaveDialog}
      <button
        type="button"
        onClick={goBack}
        aria-label="Back"
        title="Back"
        className="flex shrink-0 items-center rounded px-2 py-1.5 hover:bg-hover"
      >
        <ArrowLeft size={18} strokeWidth={1.75} className="text-navy" />
      </button>
    </>
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
  const [confirm, confirmDialog] = useConfirm();
  const deleteConfirmed = useRef(false);
  return (
    <>
      {confirmDialog}
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
          onSubmit={async (e) => {
            if (deleteConfirmed.current) {
              deleteConfirmed.current = false;
              return;
            }
            e.preventDefault();
            const form = e.currentTarget;
            const ok = await confirm({
              title: "Delete permanently?",
              message: "This can't be undone. For housekeeping, use Archive instead — it can be reversed.",
              confirmLabel: "Delete",
              danger: true,
            });
            if (ok) {
              deleteConfirmed.current = true;
              form.requestSubmit();
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
