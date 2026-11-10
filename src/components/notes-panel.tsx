"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteNoteAction, saveNoteAction, type NoteFormState } from "@/app/(app)/notes/actions";
import { useConfirm } from "@/components/confirm-dialog";
import { inputCls, Section, Select } from "@/components/fields";
import { PendingButton } from "@/components/pending-button";
import { SearchSelect, type Option } from "@/components/search-select";
import { NOTE_SOURCES } from "@/domain/options";
import { attribution } from "@/domain/notes";
import type { NoteRow } from "@/server/notes";
import type { ListLayout } from "@/server/list-layouts";
import { DataGrid, type Column, type Row } from "@/components/data-grid";

const smallBtn = "rounded-sm border border-navy px-3 py-1.5 text-sm font-semibold text-navy hover:bg-hover disabled:opacity-50";

export type NoteOptions = {
  companies: Option[];
  deals: Option[];
  contacts: { id: string; name: string; companyId: string }[];
  /** The ICM team roster — the only people a note can be attributed to (Haili, 2026-11-10). */
  authors: Option[];
  /** The signed-in user's contact, when they're on the roster. */
  defaultAuthorId: string | null;
  /** This person's saved columns for the notes table. */
  layout: ListLayout | null;
};

const when = (d: Date) => new Date(d).toLocaleDateString("en-US", { timeZone: "America/Chicago" });

/**
 * Notes on a company, deal or contact page: add a note, read them newest first, edit one.
 * `fixed` pins the fields the page already knows (a company page always files notes on that
 * company; a deal page tags them to that deal).
 */
export function NotesPanel({
  notes,
  fixed,
  options,
  canDelete,
}: {
  notes: NoteRow[];
  fixed: { companyId?: string; dealId?: string; contactId?: string };
  options: NoteOptions;
  canDelete: boolean;
}) {
  // The side panel (Haili, 2026-11-10): "new" to add a note, or a note's id to read it — with
  // `editing` switching that note to its form.
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const close = () => {
    setOpen(null);
    setEditing(false);
  };
  const note = open && open !== "new" ? notes.find((n) => n.id === open) ?? null : null;

  // Context the page already shows is left out of the table (no Company column on a company page).
  const columns: Column[] = [
    { key: "loggedLabel", label: "Logged", sortKey: "logged", type: "date" },
    { key: "subject", label: "Subject" },
    { key: "author", label: "Author" },
    { key: "source", label: "Source" },
    ...(fixed.companyId ? [] : [{ key: "company", label: "Company" }]),
    ...(fixed.dealId ? [] : [{ key: "deal", label: "Deal" }]),
    ...(fixed.contactId ? [] : [{ key: "contact", label: "Contact" }]),
    { key: "body", label: "Note" },
  ];
  const day = (d: Date) => new Date(d).toLocaleDateString("sv-SE", { timeZone: "America/Chicago" });
  const rows: Row[] = notes.map((n) => ({
    id: n.id,
    logged: day(n.loggedAt),
    loggedLabel: when(n.loggedAt),
    subject: n.subject,
    author: attribution(n),
    source: n.source,
    company: n.companyName,
    deal: n.dealName,
    contact: n.contactName,
    body: n.body,
  }));

  return (
    <Section
      title={`Notes (${notes.length})`}
      action={
        <button type="button" onClick={() => (setOpen("new"), setEditing(true))} className={smallBtn}>
          + Add note
        </button>
      }
    >
      {notes.length === 0 ? (
        <p className="text-sm text-muted">No notes yet.</p>
      ) : (
        <DataGrid
          embedded
          views={[{ label: "Notes", href: "#", active: true }]}
          listKey="notes-panel"
          savedColumns={options.layout}
          columns={columns}
          rows={rows}
          defaultSort={{ key: "logged", dir: "desc" }}
          onRowClick={(r) => (setOpen(String(r.id)), setEditing(false))}
          selectedId={open}
        />
      )}
      {open && (
        <aside
          aria-label={open === "new" ? "Add a note" : "Note"}
          className="fixed inset-y-0 right-0 z-40 flex w-[min(36rem,100vw)] flex-col border-l border-border bg-card shadow-2xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border bg-navy px-5 py-3 text-white">
            <h2 className="font-serif text-lg">{open === "new" ? "Add a note" : editing ? "Edit note" : "Note"}</h2>
            <button type="button" onClick={close} aria-label="Close" className="text-sm hover:underline">
              Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {open === "new" ? (
              <NoteForm note={null} fixed={fixed} options={options} onDone={close} canDelete={false} />
            ) : note && editing ? (
              <NoteForm key={note.id} note={note} fixed={fixed} options={options} onDone={close} canDelete={canDelete} />
            ) : note ? (
              <NoteView note={note} onEdit={() => setEditing(true)} />
            ) : (
              <p className="text-sm text-muted">This note is no longer here.</p>
            )}
          </div>
        </aside>
      )}
    </Section>
  );
}

/** One note, read-only, in the side panel. */
function NoteView({ note: n, onEdit }: { note: NoteRow; onEdit: () => void }) {
  const fact = (label: string, value: React.ReactNode) =>
    value ? (
      <div className="grid grid-cols-[7rem_1fr] gap-2 text-sm">
        <span className="text-muted">{label}</span>
        <span>{value}</span>
      </div>
    ) : null;
  return (
    <div className="flex flex-col gap-3">
      {n.subject && <h3 className="font-serif text-lg">{n.subject}</h3>}
      {fact("Author", attribution(n))}
      {fact("Logged", when(n.loggedAt))}
      {fact("Source", n.source)}
      {fact(
        "Company",
        <Link href={`/companies/${n.companyId}?tab=notes`} className="text-link hover:underline">
          {n.companyName}
        </Link>,
      )}
      {n.dealId &&
        fact(
          "Deal",
          <Link href={`/deals/${n.dealId}?tab=notes`} className="text-link hover:underline">
            {n.dealName}
          </Link>,
        )}
      {n.contactId &&
        fact(
          "Contact",
          <Link href={`/contacts/${n.contactId}`} className="text-link hover:underline">
            {n.contactName}
          </Link>,
        )}
      {n.lastModifiedAt.getTime() - n.loggedAt.getTime() > 60_000 && fact("Edited", when(n.lastModifiedAt))}
      <p className="mt-2 whitespace-pre-wrap rounded-sm border border-border bg-background p-3 text-sm">{n.body}</p>
      <div>
        <button type="button" onClick={onEdit} className={smallBtn}>
          Edit note
        </button>
      </div>
    </div>
  );
}

function NoteForm({
  note,
  fixed,
  options,
  onDone,
  canDelete,
}: {
  note: NoteRow | null;
  fixed: { companyId?: string; dealId?: string; contactId?: string };
  options: NoteOptions;
  onDone: () => void;
  canDelete: boolean;
}) {
  const [state, formAction] = useActionState<NoteFormState, FormData>(saveNoteAction.bind(null, note?.id ?? null), { message: null });
  const fixedContact = fixed.contactId ? options.contacts.find((c) => c.id === fixed.contactId) : null;
  const [companyId, setCompanyId] = useState<string | null>(
    note?.companyId ?? fixed.companyId ?? fixedContact?.companyId ?? null,
  );
  const companyContacts = options.contacts.filter((c) => c.companyId === companyId);
  const [confirm, dialog] = useConfirm();
  const [busy, startBusy] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (state.saved) onDone();
  }, [state.saved, onDone]);

  async function remove() {
    if (!note) return;
    const ok = await confirm({
      title: "Delete this note?",
      message: "It will be removed for good. Only delete notes entered in error.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    startBusy(async () => {
      await deleteNoteAction(note.id);
      onDone();
      router.refresh();
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {dialog}
      <div className="grid grid-cols-1 gap-3">
        {fixed.companyId || fixed.contactId ? (
          <input type="hidden" name="companyId" value={companyId ?? ""} />
        ) : (
          <SearchSelect
            name="companyId"
            label="Company"
            layout="stacked"
            options={options.companies}
            defaultId={companyId}
            onChange={setCompanyId}
            placeholder="Search companies…"
          />
        )}
        {fixed.dealId ? (
          <input type="hidden" name="dealId" value={fixed.dealId} />
        ) : (
          <SearchSelect
            name="dealId"
            label="Deal (optional)"
            layout="stacked"
            options={options.deals}
            defaultId={note?.dealId}
            placeholder="Tag a deal…"
          />
        )}
        {fixed.contactId ? (
          <input type="hidden" name="contactId" value={fixed.contactId} />
        ) : (
          <SearchSelect
            key={companyId ?? "none"}
            name="contactId"
            label="Contact (optional)"
            layout="stacked"
            options={companyContacts}
            defaultId={note && note.companyId === companyId ? note.contactId : null}
            placeholder={!companyId ? "Pick the company first" : companyContacts.length ? "Search this company's contacts…" : "No contacts at this company yet"}
          />
        )}
        <SearchSelect
          name="authorId"
          label="Author"
          layout="stacked"
          options={options.authors}
          defaultId={note ? note.authorId : options.defaultAuthorId}
          placeholder="Whose note is it?"
        />
        <div className="flex flex-col gap-1 text-sm">
          <Select label="Source" name="source" options={NOTE_SOURCES} defaultValue={note?.source} />
        </div>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Subject</span>
        <input name="subject" defaultValue={note?.subject ?? ""} className={inputCls} placeholder="e.g. Intro call re: Park 10" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Note</span>
        <textarea name="body" defaultValue={note?.body ?? ""} rows={8} className={inputCls} />
      </label>
      {state.message && <p className="text-sm text-danger">{state.message}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <PendingButton className={smallBtn} pendingLabel="Saving…">
          {note ? "Save note" : "Add note"}
        </PendingButton>
        <button type="button" onClick={onDone} className="text-sm text-muted hover:text-foreground">
          Cancel
        </button>
        {note && canDelete && (
          <button type="button" disabled={busy} onClick={remove} className="ml-auto text-sm text-muted hover:text-danger">
            Delete note
          </button>
        )}
      </div>
    </form>
  );
}
