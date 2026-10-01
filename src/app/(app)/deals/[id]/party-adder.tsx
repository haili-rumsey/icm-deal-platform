"use client";

import { useActionState, useEffect, useState } from "react";
import { inputCls } from "@/components/fields";
import { OverrideField } from "@/components/override-field";
import { PendingButton } from "@/components/pending-button";
import { SearchSelect, type Option } from "@/components/search-select";
import type { QuickCompanyState } from "../actions";

type ContactOption = { id: string; name: string; companyId: string };

const boxCls = "flex flex-col gap-3 rounded-sm border border-dashed border-gray p-3";
const primaryBtn =
  "self-start rounded-sm border border-navy px-3 py-1.5 text-sm font-semibold text-navy hover:bg-hover";

/**
 * Add a company (and optionally one of its contacts) to one side of the deal.
 * If the company isn't in the system, create it right here without leaving the deal.
 */
export function PartyAdder({
  side,
  label,
  companies,
  contacts,
  action,
  createAction,
}: {
  side: "A" | "B";
  label: string;
  companies: Option[];
  contacts: ContactOption[];
  action: (fd: FormData) => Promise<void>;
  createAction: (prev: QuickCompanyState, fd: FormData) => Promise<QuickCompanyState>;
}) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [newName, setNewName] = useState<string | null>(null);
  const companyContacts = contacts.filter((c) => c.companyId === companyId);
  const sideLabel = /^Side /.test(label) ? label : label.toLowerCase();

  if (newName !== null) {
    return <QuickCompany side={side} sideLabel={sideLabel} name={newName} action={createAction} onDone={() => setNewName(null)} />;
  }

  return (
    <form
      key={formKey}
      action={async (fd) => {
        await action(fd);
        setCompanyId(null);
        setFormKey((k) => k + 1);
      }}
      className={boxCls}
    >
      <input type="hidden" name="side" value={side} />
      <SearchSelect
        name="companyId"
        label={`Add ${sideLabel} company`}
        layout="stacked"
        options={companies}
        onChange={setCompanyId}
        placeholder="Search companies…"
        createLabel={(q) => `Create “${q}” as a new company`}
        onCreate={setNewName}
      />
      {companyId && (
        <SearchSelect
          key={companyId}
          name="contactId"
          label="Contact (optional)"
          layout="stacked"
          options={companyContacts}
          placeholder={companyContacts.length ? "Search this company's contacts…" : "No contacts at this company yet"}
        />
      )}
      {companyId ? (
        <PendingButton className={primaryBtn} pendingLabel="Adding…">
          Add to {sideLabel} side
        </PendingButton>
      ) : (
        <button type="button" disabled className="self-start rounded-sm border border-gray px-3 py-1.5 text-sm font-semibold text-muted opacity-60">
          Add to {sideLabel} side
        </button>
      )}
    </form>
  );
}

function QuickCompany({
  side,
  sideLabel,
  name,
  action,
  onDone,
}: {
  side: "A" | "B";
  sideLabel: string;
  name: string;
  action: (prev: QuickCompanyState, fd: FormData) => Promise<QuickCompanyState>;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [submitted, setSubmitted] = useState(false);

  // A successful save returns no message: close the form.
  useEffect(() => {
    if (submitted && !pending && state === null) onDone();
  }, [submitted, pending, state, onDone]);

  return (
    <form
      action={(fd) => {
        setSubmitted(true);
        formAction(fd);
      }}
      className={boxCls}
    >
      <p className="text-sm font-semibold">New company for the {sideLabel} side</p>
      <input type="hidden" name="side" value={side} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Name</span>
        <input name="name" defaultValue={name} required className={inputCls} />
        <span className="text-xs text-muted">The institutional owner&apos;s real name, never the LP or LLC.</span>
      </label>
      <OverrideField
        label="Website"
        name="website"
        overrideName="noWebsite"
        overrideLabel="No website (flags for cleanup)"
        placeholder="blackstone.com"
      />
      {state?.message && <p className="text-sm text-danger">{state.message}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={`${primaryBtn} disabled:opacity-50`}>
          {pending ? "Creating…" : `Create and add to ${sideLabel} side`}
        </button>
        <button type="button" onClick={onDone} className="text-sm text-muted hover:text-foreground">
          Cancel
        </button>
      </div>
      <p className="text-xs text-muted">Type, strategy and contacts can be added on the company&apos;s page later.</p>
    </form>
  );
}
