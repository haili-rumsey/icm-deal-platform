"use client";

import { useState } from "react";

/**
 * Company website / contact email: required by default, with an explicit "none"
 * override that flags the record for cleanup. One of the PRD's few hard requirements.
 */
export function OverrideField({
  label,
  name,
  overrideName,
  overrideLabel,
  type = "text",
  placeholder,
  defaultValue,
  defaultOverride,
}: {
  label: string;
  name: string;
  overrideName: string;
  overrideLabel: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string | null;
  defaultOverride?: boolean;
}) {
  const [none, setNone] = useState(!!defaultOverride);
  return (
    <div className="flex min-w-0 flex-col gap-1 text-sm">
      <label className="flex flex-col gap-1">
        <span className="font-medium">{label}</span>
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          defaultValue={defaultValue ?? ""}
          required={!none}
          disabled={none}
          className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:border-accent disabled:opacity-50"
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          name={overrideName}
          checked={none}
          onChange={(e) => setNone(e.target.checked)}
          className="h-3.5 w-3.5 accent-accent"
        />
        {overrideLabel}
      </label>
    </div>
  );
}
