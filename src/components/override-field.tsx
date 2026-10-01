"use client";

import { useState, useTransition } from "react";
import type { Match } from "@/server/duplicates";
import { DuplicateWarning } from "./duplicate-warning";
import { FieldRow, inputCls } from "./fields";

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
  duplicateCheck,
  duplicateTitle = "Already in the system",
}: {
  label: string;
  name: string;
  overrideName: string;
  overrideLabel: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string | null;
  defaultOverride?: boolean;
  /** Looks up existing records with the same value; shown as a warning, never a block. */
  duplicateCheck?: (value: string) => Promise<Match[]>;
  duplicateTitle?: string;
}) {
  const [none, setNone] = useState(!!defaultOverride);
  const [matches, setMatches] = useState<Match[]>([]);
  const [, start] = useTransition();
  const [checked, setChecked] = useState(defaultValue ?? "");

  function check(value: string) {
    if (!duplicateCheck || value.trim() === checked.trim()) return;
    setChecked(value);
    if (!value.trim()) return setMatches([]);
    start(async () => setMatches(await duplicateCheck(value)));
  }
  return (
    <FieldRow label={label} htmlFor={name}>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        required={!none}
        disabled={none}
        onBlur={(e) => check(e.target.value)}
        className={inputCls}
      />
      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          name={overrideName}
          checked={none}
          onChange={(e) => setNone(e.target.checked)}
          className="h-3.5 w-3.5 accent-navy"
        />
        {overrideLabel}
      </label>
      {!none && <DuplicateWarning title={duplicateTitle} matches={matches} />}
    </FieldRow>
  );
}
