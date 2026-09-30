"use client";

import { useState } from "react";
import { SearchSelect, type Option } from "./search-select";

/** Pick several records (e.g. both JV partners as current owners). Submits each id under `name`. */
export function MultiSelect({
  name,
  label,
  options,
  defaultIds = [],
}: {
  name: string;
  label: string;
  options: Option[];
  defaultIds?: string[];
}) {
  const [ids, setIds] = useState<string[]>(defaultIds);
  const [pickerKey, setPickerKey] = useState(0);
  const chosen = ids.map((id) => options.find((o) => o.id === id)).filter((o): o is Option => !!o);

  return (
    <div className="flex flex-col gap-2">
      {ids.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <SearchSelect
        key={pickerKey}
        name=""
        label={label}
        options={options.filter((o) => !ids.includes(o.id))}
        placeholder="Search to add…"
        onChange={(id) => {
          if (id) {
            setIds((prev) => [...prev, id]);
            setPickerKey((k) => k + 1);
          }
        }}
      />
      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {chosen.map((o) => (
            <li key={o.id} className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-sm">
              {o.name}
              <button
                type="button"
                aria-label={`Remove ${o.name}`}
                onClick={() => setIds((prev) => prev.filter((x) => x !== o.id))}
                className="text-muted hover:text-foreground"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
