"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Columns3, FileSpreadsheet, ListFilter, Search, X } from "lucide-react";
import { saveListLayoutAction } from "@/app/(app)/list-layout-actions";
import { CommandBar, CommandButton, CommandDivider } from "./command-bar";
import { exportToExcel } from "./data-grid-export";
import { FilterMenu } from "./data-grid-filter-menu";
import { applyFilters, describe, displayText, type Filter, type ValueType } from "./data-grid-filters";

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
  /** Sort, filter and export on a different field than the one displayed (e.g. an ISO date behind a label). */
  sortKey?: string;
  /**
   * What the sort field holds: "money" and "number" filter on a min–max, "date"
   * (ISO "2026-06-01…") on a from–to; both export as real Excel values.
   * Defaults to "number" for number columns, otherwise "text" (a checklist of values).
   */
  type?: ValueType;
  /** The cell is a ", "-separated list (e.g. several cities); the checklist offers each item. */
  multi?: boolean;
  /** Offered under "Edit columns" but not shown until someone switches it on. */
  defaultHidden?: boolean;
};

export type View = { label: string; href: string; active: boolean };

/** Visible column keys: the saved choice (unknown keys dropped), else the defaults. The first column always shows. */
function visibleKeys(columns: Column[], saved: string[] | null | undefined) {
  const known = new Set(columns.map((c) => c.key));
  const picked = saved?.filter((k) => known.has(k)) ?? [];
  const keys = picked.length ? picked : columns.filter((c) => !c.defaultHidden).map((c) => c.key);
  return new Set([columns[0].key, ...keys]);
}

/**
 * A Dynamics-style list: view switcher in the title, instant Quick find,
 * click a column header to sort (click again to reverse), a filter on every
 * column, "Edit columns" to choose what shows — remembered per person under
 * `listKey` — and Export to Excel of exactly what's on screen.
 *
 * Renders the page's command bar too, so Export sits beside the page's own
 * commands (`commands`).
 */
export function DataGrid({
  views,
  columns: allColumns,
  rows,
  defaultSort,
  listKey,
  savedColumns,
  commands,
  emptyText = "We didn't find anything to show here.",
}: {
  views: View[];
  columns: Column[];
  rows: Row[];
  defaultSort?: { key: string; dir: "asc" | "desc" };
  /** Where this person's column choice is saved, e.g. "deals-closed". */
  listKey: string;
  savedColumns?: string[] | null;
  /** The page's commands (New, Refresh…); Export to Excel is added after them. */
  commands?: React.ReactNode;
  emptyText?: string;
}) {
  const [visible, setVisible] = useState(() => visibleKeys(allColumns, savedColumns));
  const columns = useMemo(() => allColumns.filter((c) => visible.has(c.key)), [allColumns, visible]);
  const [, startSave] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function choose(next: Set<string> | null) {
    setVisible(next ?? visibleKeys(allColumns, null));
    // Several quick clicks become one save of the final choice.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const columns = next ? allColumns.filter((c) => next.has(c.key)).map((c) => c.key) : null;
    saveTimer.current = setTimeout(() => startSave(() => saveListLayoutAction(listKey, columns)), 400);
  }
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(defaultSort ?? { key: allColumns[0].key, dir: "asc" as const });
  // Filters last while you're on the page; they aren't saved.
  const [filters, setFilters] = useState<Record<string, Filter>>({});
  const [openFilter, setOpenFilter] = useState<{ key: string; anchor: HTMLElement } | null>(null);
  const [exporting, setExporting] = useState(false);
  const active = views.find((v) => v.active) ?? views[0];

  // The view switcher and Edit columns are <details> drop-downs, which only close
  // when their own button is clicked; also close them on a click elsewhere or Escape.
  const toolbar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function closeOthers(keep: EventTarget | null) {
      toolbar.current?.querySelectorAll("details[open]").forEach((d) => {
        if (!(keep instanceof Node && d.contains(keep))) d.removeAttribute("open");
      });
    }
    const onDown = (e: MouseEvent) => closeOthers(e.target);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeOthers(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function setFilter(key: string, f: Filter | null) {
    setFilters((prev) => {
      const next = { ...prev };
      if (f) next[key] = f;
      else delete next[key];
      return next;
    });
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = applyFilters(rows, allColumns, filters).filter(
      (r) => !q || columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q)),
    );
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
  }, [rows, allColumns, columns, filters, query, sort]);

  function toggle(key: string) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  async function onExport() {
    setExporting(true);
    try {
      await exportToExcel({ title: active.label, shown: columns, all: allColumns, rows: shown });
    } finally {
      setExporting(false);
    }
  }

  const filtered = allColumns.filter((c) => filters[c.key]);
  const narrowed = shown.length !== rows.length;
  const openColumn = openFilter && allColumns.find((c) => c.key === openFilter.key);

  return (
    <>
      <CommandBar>
        {commands}
        {commands && <CommandDivider />}
        <CommandButton icon={FileSpreadsheet} onClick={onExport} disabled={exporting || shown.length === 0}>
          {exporting ? "Exporting…" : "Export to Excel"}
        </CommandButton>
      </CommandBar>
      <div className="m-3 rounded-md border border-border bg-card shadow-sm sm:m-5">
        <div ref={toolbar} className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-serif text-lg text-foreground">
              {active.label}
              <span className="font-sans text-sm text-muted">
                ({narrowed ? `${shown.length} of ${rows.length}` : rows.length})
              </span>
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
          <div className="flex items-center gap-2">
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded border border-border px-2.5 py-1.5 text-sm hover:bg-hover">
                <Columns3 size={16} strokeWidth={1.75} className="text-navy" />
                Edit columns
              </summary>
              <div className="absolute right-0 z-20 mt-1 max-h-96 w-64 overflow-y-auto rounded-md border border-border bg-card py-1 shadow-lg">
                {allColumns.map((c, i) => (
                  <label key={c.key} className={`flex items-center gap-2 px-3 py-1.5 text-sm ${i === 0 ? "text-muted" : "cursor-pointer hover:bg-hover"}`}>
                    <input
                      type="checkbox"
                      checked={visible.has(c.key)}
                      disabled={i === 0}
                      onChange={(e) => {
                        const next = new Set(visible);
                        if (e.target.checked) next.add(c.key);
                        else next.delete(c.key);
                        choose(next);
                      }}
                    />
                    {c.label}
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => choose(null)}
                  className="mt-1 w-full border-t border-border px-3 pt-2 pb-1 text-left text-xs text-link hover:underline"
                >
                  Reset to default columns
                </button>
              </div>
            </details>
            <label className="flex flex-1 items-center gap-2 rounded border border-border px-2.5 py-1.5 sm:w-72 sm:flex-none focus-within:border-navy">
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
        </div>

        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-4 pt-3 sm:px-5">
            <ListFilter size={16} className="text-navy" aria-hidden />
            {filtered.map((c) => (
              <span key={c.key} className="inline-flex max-w-full items-center gap-1 rounded-full border border-navy/30 bg-background py-0.5 pr-1 pl-2.5 text-xs">
                <button
                  type="button"
                  className="truncate hover:underline"
                  onClick={(e) => {
                    // Reopen the filter under its column header, or under the chip if the column is hidden.
                    const th = document.getElementById(`filter-${listKey}-${c.key}`);
                    setOpenFilter({ key: c.key, anchor: th ?? e.currentTarget });
                  }}
                >
                  {describe(c, filters[c.key])}
                  {!visible.has(c.key) && <span className="text-muted"> (hidden column)</span>}
                </button>
                <button type="button" aria-label={`Remove ${c.label} filter`} onClick={() => setFilter(c.key, null)} className="rounded-full p-0.5 hover:bg-hover">
                  <X size={12} />
                </button>
              </span>
            ))}
            <button type="button" onClick={() => setFilters({})} className="text-xs text-link hover:underline">
              Clear all filters
            </button>
          </div>
        )}

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                {columns.map((c) => {
                  const sk = c.sortKey ?? c.key;
                  const isSorted = sort.key === sk;
                  const Arrow = sort.dir === "asc" ? ArrowUp : ArrowDown;
                  const isFiltered = Boolean(filters[c.key]);
                  return (
                    <th
                      key={c.key}
                      aria-sort={isSorted ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                      className={`whitespace-nowrap px-4 py-2 font-semibold first:pl-5 ${c.kind === "number" ? "text-right" : ""}`}
                    >
                      <span className={`inline-flex items-center gap-1.5 ${c.kind === "number" ? "flex-row-reverse" : ""}`}>
                        <button
                          type="button"
                          onClick={() => toggle(sk)}
                          className={`inline-flex items-center gap-1 hover:text-navy ${c.kind === "number" ? "flex-row-reverse" : ""}`}
                        >
                          {c.label}
                          {isSorted ? <Arrow size={14} /> : <ChevronDown size={14} className="text-muted" />}
                        </button>
                        <button
                          type="button"
                          id={`filter-${listKey}-${c.key}`}
                          aria-label={`Filter ${c.label}`}
                          aria-pressed={isFiltered}
                          title={isFiltered ? describe(c, filters[c.key]) : `Filter ${c.label}`}
                          onClick={(e) => {
                            const anchor = e.currentTarget;
                            setOpenFilter((o) => (o?.key === c.key ? null : { key: c.key, anchor }));
                          }}
                          className={`rounded p-0.5 ${isFiltered ? "bg-navy text-white" : "text-muted hover:bg-hover hover:text-navy"}`}
                        >
                          <ListFilter size={13} />
                        </button>
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={String(r.id ?? i)} className="border-b border-border last:border-0 hover:bg-background">
                  {columns.map((c) => {
                    const text = displayText(r[c.key], c.kind);
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
            <p className="px-5 py-16 text-center text-sm text-muted">
              {query || filtered.length ? "Nothing matches your search and filters." : emptyText}
            </p>
          )}
        </div>
      </div>
      {openColumn && openFilter && (
        <FilterMenu
          key={openColumn.key}
          column={openColumn}
          rows={applyFilters(rows, allColumns, filters, openColumn.key)}
          filter={filters[openColumn.key]}
          anchor={openFilter.anchor}
          onChange={(f) => setFilter(openColumn.key, f)}
          onClose={() => setOpenFilter(null)}
        />
      )}
    </>
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
