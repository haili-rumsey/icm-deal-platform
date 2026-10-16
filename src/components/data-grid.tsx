"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Columns3, FileSpreadsheet, List, ListFilter, Search, X, type LucideIcon } from "lucide-react";
import { saveListLayoutAction } from "@/app/(app)/list-layout-actions";
import type { ListLayout } from "@/server/list-layouts";
import { CommandBar, CommandButton, CommandDivider } from "./command-bar";
import { BackCommand } from "./record-page";
import { exportToExcel } from "./data-grid-export";
import { FilterMenu } from "./data-grid-filter-menu";
import { applyFilters, describe, displayText, type Filter, type ValueType } from "./data-grid-filters";
import { buildBlocks, countLabel, formatTotal, type Grouping } from "./data-grid-groups";

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
  /** Summed on subtotal rows when the list is grouped. */
  total?: boolean;
  /** Hover text for the cell, from row[titleKey] (e.g. a full name behind "Haili R."). */
  titleKey?: string;
};

export type View = { label: string; href: string; active: boolean };

/**
 * Visible column keys in display order: the saved choice (unknown keys dropped), else the
 * defaults. The list's first column always shows (it can be moved).
 */
function visibleOrder(columns: Column[], saved: string[] | null | undefined) {
  const known = new Set(columns.map((c) => c.key));
  const picked = saved?.filter((k) => known.has(k)) ?? [];
  const keys = [...new Set(picked.length ? picked : columns.filter((c) => !c.defaultHidden).map((c) => c.key))];
  return keys.includes(columns[0].key) ? keys : [columns[0].key, ...keys];
}

/** Narrowest a column can be dragged to. */
const MIN_WIDTH = 60;

/**
 * A Dynamics-style list: view switcher in the title, instant Quick find,
 * click a column header to sort (click again to reverse), a filter on every
 * column, "Edit columns" to choose what shows, drag a header's right edge to
 * set a column's width (double-click it to fit again) — both remembered per
 * person under `listKey` — and Export to Excel of exactly what's on screen.
 * Text stays on one line (Haili, 1.6); a narrowed column ends in "…" with the
 * full text on hover.
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
  grouping,
  embedded = false,
  altView,
  emptyText = "We didn't find anything to show here.",
  onRowClick,
  selectedId,
}: {
  views: View[];
  columns: Column[];
  rows: Row[];
  defaultSort?: { key: string; dir: "asc" | "desc" };
  /** Where this person's column choice and widths are saved, e.g. "deals-closed". */
  listKey: string;
  savedColumns?: ListLayout | null;
  /** The page's commands (New, Refresh…); Export to Excel is added after them. */
  commands?: React.ReactNode;
  /** Show rows in fixed sections with subtotals (the Pipeline report's stages). */
  grouping?: Grouping;
  /** Part of a larger page (e.g. a report's drill-down): no command bar of its own; Export sits in the toolbar. */
  embedded?: boolean;
  /**
   * Another way to show the same rows (the Property report's map): a List / <label>
   * switch appears, and the alternative is drawn from the rows the filters leave.
   */
  altView?: { label: string; icon: LucideIcon; render: (rows: Row[]) => React.ReactNode };
  emptyText?: string;
  /** Clicking a row (not its links or buttons) calls this, e.g. to open a quick-edit panel. */
  onRowClick?: (row: Row) => void;
  /** The row shown as selected (by `id`). */
  selectedId?: string | null;
}) {
  const [showAlt, setShowAlt] = useState(false);
  const [order, setOrder] = useState(() => visibleOrder(allColumns, savedColumns?.columns));
  const visible = useMemo(() => new Set(order), [order]);
  // Header being dragged to a new place, and the header it's over.
  const [drag, setDrag] = useState<{ key: string; over: string | null } | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>(() => savedColumns?.widths ?? {});
  // The widths as of the last render, for saving at the end of a drag.
  const widthsRef = useRef(widths);
  useEffect(() => {
    widthsRef.current = widths;
  }, [widths]);
  const columns = useMemo(() => {
    const byKey = new Map(allColumns.map((c) => [c.key, c]));
    return order.map((k) => byKey.get(k)).filter((c): c is Column => !!c);
  }, [allColumns, order]);
  const [, startSave] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Shown columns in order (null = the list's defaults), saved for this person. */
  function choose(next: string[] | null) {
    setOrder(next ?? visibleOrder(allColumns, null));
    // Several quick clicks become one save of the final choice.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => startSave(() => saveListLayoutAction(listKey, { columns: next })), 400);
  }
  /** Drop a dragged header onto another: it takes that one's place. */
  function moveColumn(key: string, onto: string) {
    const from = order.indexOf(key);
    const to = order.indexOf(onto);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, key);
    choose(next);
  }
  function saveWidths(next: Record<string, number>) {
    setWidths(next);
    startSave(() => saveListLayoutAction(listKey, { widths: Object.keys(next).length ? next : null }));
  }
  /** Drag a header's right edge: the column follows the pointer, and the width is saved on release. */
  function startResize(key: string, e: React.PointerEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    const th = e.currentTarget.closest("th");
    if (!th) return;
    const startX = e.clientX;
    // The width is the content's, inside the cell padding.
    const cs = getComputedStyle(th);
    const startW = th.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    let latest = startW;
    const move = (ev: PointerEvent) => {
      latest = Math.max(MIN_WIDTH, Math.round(startW + ev.clientX - startX));
      setWidths((w) => ({ ...w, [key]: latest }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      if (latest !== startW) saveWidths({ ...widthsRef.current, [key]: latest });
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  /**
   * A set width goes on a wrapper inside the cell (tables ignore a cell's max width), so long
   * text ends in "…" rather than widening the column.
   */
  const widthStyle = (key: string) => (widths[key] ? { width: widths[key] } : undefined);
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
      await exportToExcel({ title: active.label, shown: columns, all: allColumns, rows: shown, grouping, keepEmpty: !narrowed });
    } finally {
      setExporting(false);
    }
  }

  const filtered = allColumns.filter((c) => filters[c.key]);
  const narrowed = shown.length !== rows.length;
  const blocks = grouping ? buildBlocks(shown, allColumns, grouping, !narrowed) : null;

  function renderRow(r: Row, i: number) {
    return (
      <tr
        key={String(r.id ?? i)}
        onClick={
          onRowClick
            ? (e) => {
                // Links and buttons in the row keep doing their own thing.
                if ((e.target as HTMLElement).closest("a,button,input,select,textarea")) return;
                onRowClick(r);
              }
            : undefined
        }
        aria-selected={onRowClick ? selectedId === r.id : undefined}
        className={`border-b border-border last:border-0 ${onRowClick ? "cursor-pointer" : ""} ${
          selectedId != null && selectedId === r.id ? "bg-[#e6eef8]" : "hover:bg-background"
        }`}
      >
        {columns.map((c) => {
          const text = displayText(r[c.key], c.kind);
          const flagged = c.flagKey && r[c.flagKey] === true;
          const title = c.titleKey ? displayText(r[c.titleKey], "text") || undefined : undefined;
          return (
            <td
              key={c.key}
              title={title ?? (widths[c.key] && text ? text : undefined)}
              className={`whitespace-nowrap px-4 py-2.5 first:pl-5 ${c.kind === "number" || c.total ? "text-right tabular-nums" : ""}`}
            >
              <div style={widthStyle(c.key)} className="overflow-hidden text-ellipsis">
                {c.kind === "link" && c.hrefKey ? (
                  <Link href={String(r[c.hrefKey])} className="font-bold text-link hover:underline">
                    {text || "(untitled)"}
                  </Link>
                ) : (
                  text
                )}
                {flagged && <FlagMark label={c.flagLabel ?? "Needs cleanup"} />}
              </div>
            </td>
          );
        })}
      </tr>
    );
  }

  /** A subtotal or grand-total row: the count in the first cell, sums under their columns. */
  function totalsRow(key: string, label: string, t: { count: number; sums: Record<string, number | null> }, grand: boolean) {
    return (
      <tr key={key} className={grand ? "border-y-2 border-navy bg-navy/5 font-bold" : "border-b border-gray bg-gray-light font-bold"}>
        {columns.map((c, i) => (
          <td
            key={c.key}
            className={`whitespace-nowrap px-4 py-2 first:pl-5 ${c.total || c.kind === "number" ? "text-right tabular-nums" : ""}`}
          >
            {i === 0 ? (
              // Sized like the column; the label may run on into the empty cell beside it.
              <div style={widthStyle(c.key)} className="overflow-visible whitespace-nowrap">
                {label} · {countLabel(t.count, grouping!.unit)}
              </div>
            ) : c.total ? (
              formatTotal(c, t.sums[c.key] ?? null)
            ) : null}
          </td>
        ))}
      </tr>
    );
  }
  const openColumn = openFilter && allColumns.find((c) => c.key === openFilter.key);

  return (
    <>
      {!embedded && (
        <CommandBar>
          <BackCommand fallbackHref="/deals" />
          {commands}
          {commands && <CommandDivider />}
          <CommandButton icon={FileSpreadsheet} onClick={onExport} disabled={exporting || shown.length === 0}>
            {exporting ? "Exporting…" : "Export to Excel"}
          </CommandButton>
        </CommandBar>
      )}
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
            {altView && (
              <div role="group" aria-label="View as" className="flex shrink-0 overflow-hidden rounded border border-border text-sm">
                {[
                  { alt: false, label: "List", Icon: List },
                  { alt: true, label: altView.label, Icon: altView.icon },
                ].map(({ alt, label, Icon }) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={showAlt === alt}
                    onClick={() => setShowAlt(alt)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 ${showAlt === alt ? "bg-navy text-white" : "hover:bg-hover"}`}
                  >
                    <Icon size={16} strokeWidth={1.75} />
                    {label}
                  </button>
                ))}
              </div>
            )}
            {embedded && (
              <button
                type="button"
                onClick={onExport}
                disabled={exporting || shown.length === 0}
                className="flex items-center gap-1.5 whitespace-nowrap rounded border border-border px-2.5 py-1.5 text-sm hover:bg-hover disabled:opacity-50"
              >
                <FileSpreadsheet size={16} strokeWidth={1.75} className="text-navy" />
                {exporting ? "Exporting…" : "Export"}
              </button>
            )}
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
                      onChange={(e) => choose(e.target.checked ? [...order, c.key] : order.filter((k) => k !== c.key))}
                    />
                    {c.label}
                  </label>
                ))}
                <p className="border-t border-border px-3 pt-2 text-xs text-muted">Drag a column header left or right to move it.</p>
                <button
                  type="button"
                  onClick={() => choose(null)}
                  className="mt-1 w-full px-3 pt-1 pb-1 text-left text-xs text-link hover:underline"
                >
                  Reset to default columns and order
                </button>
                {Object.keys(widths).length > 0 && (
                  <button type="button" onClick={() => saveWidths({})} className="w-full px-3 pt-1 pb-1 text-left text-xs text-link hover:underline">
                    Reset column widths
                  </button>
                )}
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

        {altView && showAlt ? (
          <div className="mt-3">{altView.render(shown)}</div>
        ) : (
          // The table scrolls inside its own box (both ways) so the header row stays in view.
          <div className="mt-3 max-h-[calc(100vh-13rem)] overflow-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--color-border)]">
                <tr className="border-b border-border">
                  {columns.map((c) => {
                    const sk = c.sortKey ?? c.key;
                    const isSorted = sort.key === sk;
                    const right = c.kind === "number" || c.total;
                    const Arrow = sort.dir === "asc" ? ArrowUp : ArrowDown;
                    const isFiltered = Boolean(filters[c.key]);
                    return (
                      <th
                        key={c.key}
                        aria-sort={isSorted ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                        onDragOver={(e) => {
                          if (!drag) return;
                          e.preventDefault();
                          if (drag.over !== c.key) setDrag({ ...drag, over: c.key });
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (drag) moveColumn(drag.key, c.key);
                          setDrag(null);
                        }}
                        className={`relative whitespace-nowrap px-4 py-2 font-semibold first:pl-5 ${right ? "text-right" : ""} ${
                          drag?.key === c.key ? "opacity-50" : drag?.over === c.key ? "bg-[#e6eef8] shadow-[inset_3px_0_0_var(--color-blue)]" : ""
                        }`}
                      >
                        {/* Drag the header (not its edge, which resizes) to move the column. */}
                        <span
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", c.label);
                            setDrag({ key: c.key, over: null });
                          }}
                          onDragEnd={() => setDrag(null)}
                          title="Drag to move this column"
                          style={widthStyle(c.key)}
                          className={`inline-flex cursor-grab items-center gap-1.5 overflow-hidden active:cursor-grabbing ${right ? "flex-row-reverse" : ""}`}
                        >
                          <button
                            type="button"
                            onClick={() => toggle(sk)}
                            className={`inline-flex items-center gap-1 hover:text-navy ${right ? "flex-row-reverse" : ""}`}
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
                        <span
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={`Resize ${c.label} column`}
                          title="Drag to resize · double-click to fit"
                          onPointerDown={(e) => startResize(c.key, e)}
                          onDoubleClick={() => {
                            const next = { ...widths };
                            delete next[c.key];
                            saveWidths(next);
                          }}
                          className="absolute inset-y-0 right-0 w-2 cursor-col-resize border-r-2 border-transparent hover:border-blue"
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {blocks
                  ? blocks.map((b) =>
                      b.kind === "total" ? (
                        totalsRow("grand-total", b.title, b.totals, true)
                      ) : (
                        <Fragment key={b.id}>
                          <tr className="border-b border-border">
                            <th colSpan={columns.length} scope="colgroup" className="bg-blue px-5 py-2 text-left text-white">
                              <span className="font-serif text-base">{b.title}</span>
                              {b.note && <span className="ml-3 text-xs font-normal text-white/80">Date shown: {b.note}</span>}
                            </th>
                          </tr>
                          {b.rows.map(renderRow)}
                          {totalsRow(`${b.id}-total`, "Subtotal", b.totals, false)}
                        </Fragment>
                      ),
                    )
                  : shown.map(renderRow)}
              </tbody>
            </table>
            {shown.length === 0 && (
              <p className="px-5 py-16 text-center text-sm text-muted">
                {query || filtered.length ? "Nothing matches your search and filters." : emptyText}
              </p>
            )}
          </div>
        )}
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
