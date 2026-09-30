"use client";

import { useState } from "react";
import { PendingButton } from "@/components/pending-button";
import { SearchSelect, type Option } from "@/components/search-select";

type ContactOption = { id: string; name: string; companyId: string };

/** Add a company (and optionally one of its contacts) to one side of the deal. */
export function PartyAdder({
  side,
  label,
  companies,
  contacts,
  action,
}: {
  side: "A" | "B";
  label: string;
  companies: Option[];
  contacts: ContactOption[];
  action: (fd: FormData) => Promise<void>;
}) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const companyContacts = contacts.filter((c) => c.companyId === companyId);

  return (
    <form
      key={formKey}
      action={async (fd) => {
        await action(fd);
        setCompanyId(null);
        setFormKey((k) => k + 1);
      }}
      className="flex flex-col gap-3 rounded-md border border-dashed border-border p-3"
    >
      <input type="hidden" name="side" value={side} />
      <SearchSelect
        name="companyId"
        label={`Add ${label.toLowerCase()} company`}
        options={companies}
        onChange={setCompanyId}
        placeholder="Search companies…"
      />
      {companyId && (
        <SearchSelect
          key={companyId}
          name="contactId"
          label="Contact (optional)"
          options={companyContacts}
          placeholder={companyContacts.length ? "Search this company's contacts…" : "No contacts at this company yet"}
        />
      )}
      {companyId ? (
        <PendingButton
          className="self-start rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-background"
          pendingLabel="Adding…"
        >
          Add to {label.toLowerCase()} side
        </PendingButton>
      ) : (
        <button type="button" disabled className="self-start rounded-md border border-border px-3 py-1.5 text-sm font-medium opacity-50">
          Add to {label.toLowerCase()} side
        </button>
      )}
    </form>
  );
}
