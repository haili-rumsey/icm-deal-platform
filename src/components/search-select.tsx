"use client";

import { useId, useMemo, useState } from "react";
import { FieldRow, inputCls } from "./fields";

export type Option = { id: string; name: string; hint?: string | null };

/**
 * A searchable picker that submits the chosen id under `name`. Used for companies,
 * contacts, properties and Stream people.
 */
export function SearchSelect({
  name,
  label,
  options,
  defaultId,
  placeholder = "Search…",
  onChange,
  layout = "row",
}: {
  name: string;
  label: string;
  options: Option[];
  defaultId?: string | null;
  placeholder?: string;
  onChange?: (id: string | null) => void;
  layout?: "row" | "stacked";
}) {
  const listId = useId();
  const [selected, setSelected] = useState<Option | null>(() => options.find((o) => o.id === defaultId) ?? null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? options.filter((o) => o.name.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q))
      : options;
    return list.slice(0, 30);
  }, [options, query]);

  function choose(o: Option | null) {
    setSelected(o);
    setQuery("");
    setOpen(false);
    onChange?.(o?.id ?? null);
  }

  const control = (
    <div className="relative min-w-0 text-sm">
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-sm border border-[#c8c8c4] bg-white px-2.5 py-1.5">
          <span className="truncate">
            {selected.name}
            {selected.hint && <span className="ml-2 text-xs text-muted">{selected.hint}</span>}
          </span>
          <button type="button" onClick={() => choose(null)} className="text-xs text-link hover:underline">
            Change
          </button>
        </div>
      ) : (
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className={inputCls}
        />
      )}
      {open && !selected && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-card shadow-lg"
        >
          {matches.length === 0 && <li className="px-3 py-2 text-muted">No matches</li>}
          {matches.map((o) => (
            <li key={o.id} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left hover:bg-hover"
              >
                <span className="truncate">{o.name}</span>
                {o.hint && <span className="shrink-0 text-xs text-muted">{o.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (!label) return control;
  if (layout === "stacked") {
    return (
      <div className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-muted">{label}</span>
        {control}
      </div>
    );
  }
  return <FieldRow label={label}>{control}</FieldRow>;
}
