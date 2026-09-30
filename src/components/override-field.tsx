"use client";

import { useState } from "react";
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
    <FieldRow label={label} htmlFor={name}>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        required={!none}
        disabled={none}
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
    </FieldRow>
  );
}
