"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { inputCls } from "./fields";

export type PickOption = { id: string; name: string };

/**
 * A dropdown checklist: open it, tick several people at once. Submits each chosen
 * id under `name`.
 */
export function CheckboxDropdown({
  name,
  options,
  value,
  onChange,
  placeholder = "Select…",
  emptyText = "No one to choose from yet.",
}: {
  name: string;
  options: PickOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const chosen = options.filter((o) => value.includes(o.id));
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  return (
    <div ref={ref} className="relative min-w-0">
      {value.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`${inputCls} flex items-center justify-between gap-2 text-left`}
      >
        <span className={`truncate ${chosen.length ? "" : "text-muted"}`}>
          {chosen.length ? chosen.map((c) => c.name).join(", ") : placeholder}
        </span>
        <ChevronDown size={16} className="shrink-0 text-muted" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-64 rounded-md border border-border bg-card shadow-lg">
          {options.length > 8 && (
            <label className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search size={14} className="text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter…"
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
          )}
          <ul className="max-h-64 overflow-auto py-1">
            {options.length === 0 && <li className="px-3 py-2 text-sm text-muted">{emptyText}</li>}
            {shown.map((o) => (
              <li key={o.id}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-hover">
                  <input
                    type="checkbox"
                    checked={value.includes(o.id)}
                    onChange={() => toggle(o.id)}
                    className="h-4 w-4 accent-navy"
                  />
                  {o.name}
                </label>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-border px-3 py-1.5 text-xs">
            <span className="text-muted">{value.length} selected</span>
            <button type="button" onClick={() => setOpen(false)} className="font-semibold text-link hover:underline">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
