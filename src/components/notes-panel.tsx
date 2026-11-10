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

const smallBtn = "rounded-sm border border-navy px-3 py-1.5 text-sm font-semibold text-navy hover:bg-hover disabled:opacity-50";

export type NoteOptions = {
  companies: Option[];
  deals: Option[];
  contacts: { id: string; name: string; companyId: string }[];
  /** The ICM team roster — the only people a note can be attributed to (Haili, 2026-11-10). */
  authors: Option[];
  /** The signed-in user's contact, when they're on the roster. */
  defaultAuthorId: string | null;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const done = () => {
    setEditingId(null);
    setRound((n) => n + 1);
  };

  return (
    <Section title={`Notes (${notes.length})`}>
      <div className="flex flex-col gap-4">
        {editingId === null && <NoteForm key={`new-${round}`} note={null} fixed={fixed} options={options} onDone={done} canDelete={false} />}
        {notes.length === 0 ? (
          <p className="text-sm text-muted">No notes yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {notes.map((n) =>
              editingId === n.id ? (
                <li key={n.id} className="py-3">
                  <NoteForm note={n} fixed={fixed} options={options} onDone={done} canDelete={canDelete} />
                </li>
              ) : (
                <li key={n.id} className="flex flex-col gap-1 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">{attribution(n)}</span>
                    <span className="flex items-baseline gap-3 text-muted">
                      {[n.source, when(n.loggedAt)].filter(Boolean).join(" · ")}
                      <button type="button" onClick={() => setEditingId(n.id)} className="text-xs text-link hover:underline">
                        Edit
                      </button>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted">
                    {!fixed.companyId && (
                      <Link href={`/companies/${n.companyId}`} className="text-link hover:underline">
                        {n.companyName}
                      </Link>
                    )}
                    {!fixed.dealId && n.dealId && (
                      <Link href={`/deals/${n.dealId}`} className="text-link hover:underline">
                        Deal: {n.dealName}
                      </Link>
                    )}
                    {!fixed.contactId && n.contactId && (
                      <Link href={`/contacts/${n.contactId}`} className="text-link hover:underline">
                        Contact: {n.contactName}
                      </Link>
                    )}
                    {n.lastModifiedAt.getTime() - n.loggedAt.getTime() > 60_000 && <span>Edited {when(n.lastModifiedAt)}</span>}
                  </div>
                  <p className="whitespace-pre-wrap">{n.body}</p>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </Section>
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
    <form action={formAction} className="flex flex-col gap-3 rounded-sm border border-dashed border-gray p-3">
      {dialog}
      <p className="text-sm font-semibold">{note ? "Edit note" : "Add a note"}</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
        <span className="text-muted">Note</span>
        <textarea name="body" defaultValue={note?.body ?? ""} rows={4} className={inputCls} />
      </label>
      {state.message && <p className="text-sm text-danger">{state.message}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <PendingButton className={smallBtn} pendingLabel="Saving…">
          {note ? "Save note" : "Add note"}
        </PendingButton>
        {note && (
          <button type="button" onClick={onDone} className="text-sm text-muted hover:text-foreground">
            Cancel
          </button>
        )}
        {note && canDelete && (
          <button type="button" disabled={busy} onClick={remove} className="ml-auto text-sm text-muted hover:text-danger">
            Delete note
          </button>
        )}
      </div>
    </form>
  );
}
