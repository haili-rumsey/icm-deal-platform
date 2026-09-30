"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Search } from "lucide-react";

export type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;

export type Column = {
  key: string;
  label: string;
  /** "link" uses row[hrefKey]; "number" right-aligns and formats. */
  kind?: "text" | "number" | "link";
  hrefKey?: string;
  /** Show an orange cleanup marker when row[flagKey] is true. */
  flagKey?: string;
  flagLabel?: string;
  /** Sort on a different field than the one displayed (e.g. an ISO date behind a label). */
  sortKey?: string;
};

export type View = { label: string; href: string; active: boolean };

function display(v: Cell, kind: Column["kind"]) {
  if (v === null || v === "" || v === false) return "";
  if (kind === "number" && typeof v === "number") return v.toLocaleString("en-US");
  return String(v);
}

/**
 * A Dynamics-style list: view switcher in the title, instant Quick find,
 * click a column header to sort (click again to reverse).
 */
export function DataGrid({
  views,
  columns,
  rows,
  defaultSort,
  emptyText = "We didn't find anything to show here.",
}: {
  views: View[];
  columns: Column[];
  rows: Row[];
  defaultSort?: { key: string; dir: "asc" | "desc" };
  emptyText?: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(defaultSort ?? { key: columns[0].key, dir: "asc" as const });
  const active = views.find((v) => v.active) ?? views[0];

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q)))
      : rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      if (x === y) return 0;
      if (x === null || x === "") return 1; // blanks last either way
      if (y === null || y === "") return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      return String(x).localeCompare(String(y), "en", { numeric: true, sensitivity: "base" }) * dir;
    });
  }, [rows, columns, query, sort]);

  function toggle(key: string) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  return (
    <div className="m-3 rounded-md border border-border bg-card shadow-sm sm:m-5">
      <div className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <details className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-serif text-lg text-foreground">
            {active.label}
            <span className="font-sans text-sm text-muted">({rows.length})</span>
            <ChevronDown size={18} className="text-muted transition-transform group-open:rotate-180" />
          </summary>
          <ul className="absolute left-0 z-20 mt-1 min-w-48 rounded-md border border-border bg-card py-1 shadow-lg">
            {views.map((v) => (
              <li key={v.href}>
                <Link
                  href={v.href}
                  className={`block px-3 py-2 text-sm hover:bg-hover ${v.active ? "font-semibold text-navy" : ""}`}
                >
                  {v.label}
                </Link>
              </li>
            ))}
          </ul>
        </details>
        <label className="flex items-center gap-2 rounded border border-border px-2.5 py-1.5 sm:w-72 focus-within:border-navy">
          <Search size={16} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Quick find"
            aria-label="Quick find"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((c) => {
                const sk = c.sortKey ?? c.key;
                const isSorted = sort.key === sk;
                const Arrow = sort.dir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={c.key}
                    aria-sort={isSorted ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={`whitespace-nowrap px-4 py-2 font-semibold first:pl-5 ${c.kind === "number" ? "text-right" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(sk)}
                      className={`inline-flex items-center gap-1 hover:text-navy ${c.kind === "number" ? "flex-row-reverse" : ""}`}
                    >
                      {c.label}
                      {isSorted ? <Arrow size={14} /> : <ChevronDown size={14} className="text-muted" />}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={String(r.id ?? i)} className="border-b border-border last:border-0 hover:bg-background">
                {columns.map((c) => {
                  const text = display(r[c.key], c.kind);
                  const flagged = c.flagKey && r[c.flagKey] === true;
                  return (
                    <td
                      key={c.key}
                      className={`px-4 py-2.5 first:pl-5 ${c.kind === "number" ? "whitespace-nowrap text-right tabular-nums" : ""}`}
                    >
                      {c.kind === "link" && c.hrefKey ? (
                        <Link href={String(r[c.hrefKey])} className="font-semibold text-link hover:underline">
                          {text || "(untitled)"}
                        </Link>
                      ) : (
                        text
                      )}
                      {flagged && <FlagMark label={c.flagLabel ?? "Needs cleanup"} />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="px-5 py-16 text-center text-sm text-muted">{query ? "No matches for that search." : emptyText}</p>
        )}
      </div>
    </div>
  );
}

/** Sunset Orange marker for records flagged for cleanup (a secondary-palette accent). */
export function FlagMark({ label }: { label: string }) {
  return (
    <span className="ml-2 inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted">
      <span className="h-2 w-2 rounded-[1px] bg-flag" aria-hidden />
      {label}
    </span>
  );
}
