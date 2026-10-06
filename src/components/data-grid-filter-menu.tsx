"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { Column, Row } from "./data-grid";
import { BLANK, cellValues, parseAmount, quarterRange, valueType, yearRange, type Filter } from "./data-grid-filters";

const WIDTH = 272;

/**
 * The drop-down under a column header's filter icon. Text columns get Excel's
 * checklist of values; numbers and money a min–max; dates a from–to with
 * calendar-quarter shortcuts. Changes apply as you make them.
 */
export function FilterMenu({
  column,
  rows,
  filter,
  anchor,
  onChange,
  onClose,
}: {
  column: Column;
  /** Rows passing every other column's filter — the checklist offers only values still in play. */
  rows: Row[];
  filter: Filter | undefined;
  anchor: HTMLElement;
  onChange: (f: Filter | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Fixed to the viewport so the table's horizontal scroll box can't clip it. The menu is
  // keyed per column and closes on scroll or resize, so measuring once is enough.
  const [pos] = useState(() => {
    const r = anchor.getBoundingClientRect();
    return { top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - WIDTH - 8)) };
  });
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const onClose = () => close.current();
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onScroll(e: Event) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [anchor]);

  const t = valueType(column);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Filter ${column.label}`}
      style={{ top: pos.top, left: pos.left, width: WIDTH }}
      className="fixed z-40 rounded-md border border-border bg-card text-sm font-normal shadow-lg"
    >
      {t === "text" ? (
        <ValuesFilter column={column} rows={rows} filter={filter?.kind === "values" ? filter : undefined} onChange={onChange} />
      ) : t === "date" ? (
        <DatesFilter filter={filter?.kind === "dates" ? filter : undefined} onChange={onChange} />
      ) : (
        <RangeFilter money={t === "money"} filter={filter?.kind === "range" ? filter : undefined} onChange={onChange} />
      )}
      <div className="flex justify-between border-t border-border px-3 py-2">
        <button type="button" onClick={() => onChange(null)} disabled={!filter} className="text-link hover:underline disabled:text-muted disabled:no-underline">
          Clear filter
        </button>
        <button type="button" onClick={onClose} className="rounded bg-navy px-3 py-1 text-white">
          Done
        </button>
      </div>
    </div>
  );
}

function ValuesFilter({
  column,
  rows,
  filter,
  onChange,
}: {
  column: Column;
  rows: Row[];
  filter: Extract<Filter, { kind: "values" }> | undefined;
  onChange: (f: Filter | null) => void;
}) {
  const [search, setSearch] = useState("");
  const options = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) for (const v of cellValues(r, column)) counts.set(v, (counts.get(v) ?? 0) + 1);
    // A ticked value can drop out of `rows` when another filter changes; keep it listed so it can be unticked.
    for (const v of filter?.values ?? []) if (!counts.has(v)) counts.set(v, 0);
    return [...counts]
      .sort(([a], [b]) => (a === BLANK ? 1 : b === BLANK ? -1 : a.localeCompare(b, "en", { numeric: true, sensitivity: "base" })))
      .map(([value, count]) => ({ value, count }));
  }, [rows, column, filter]);

  const ticked = new Set(filter ? filter.values : options.map((o) => o.value));
  const q = search.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.value.toLowerCase().includes(q)) : options;
  const allShownTicked = shown.length > 0 && shown.every((o) => ticked.has(o.value));

  function set(next: Set<string>) {
    // Everything ticked is the same as no filter.
    onChange(options.every((o) => next.has(o.value)) ? null : { kind: "values", values: [...next] });
  }

  return (
    <div className="p-2">
      <label className="flex items-center gap-2 rounded border border-border px-2 py-1.5 focus-within:border-navy">
        <Search size={14} className="text-muted" />
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search values"
          aria-label="Search values"
          className="w-full bg-transparent outline-none"
        />
      </label>
      <div className="mt-2 max-h-64 overflow-y-auto">
        {shown.length > 0 && (
          <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 font-semibold hover:bg-hover">
            <input
              type="checkbox"
              checked={allShownTicked}
              onChange={() => {
                const next = new Set(ticked);
                for (const o of shown) {
                  if (allShownTicked) next.delete(o.value);
                  else next.add(o.value);
                }
                set(next);
              }}
            />
            {q ? "Select all matches" : "Select all"}
          </label>
        )}
        {shown.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-hover">
            <input
              type="checkbox"
              checked={ticked.has(o.value)}
              onChange={(e) => {
                const next = new Set(ticked);
                if (e.target.checked) next.add(o.value);
                else next.delete(o.value);
                set(next);
              }}
            />
            <span className={`flex-1 truncate ${o.value === BLANK ? "italic text-muted" : ""}`}>{o.value}</span>
            <span className="text-xs text-muted tabular-nums">{o.count}</span>
          </label>
        ))}
        {shown.length === 0 && <p className="px-1.5 py-3 text-muted">No values match.</p>}
      </div>
    </div>
  );
}

function RangeFilter({
  money,
  filter,
  onChange,
}: {
  money: boolean;
  filter: Extract<Filter, { kind: "range" }> | undefined;
  onChange: (f: Filter | null) => void;
}) {
  const fmt = (n: number | null | undefined) => (n == null ? "" : n.toLocaleString("en-US", { maximumFractionDigits: 2 }));
  const [min, setMin] = useState(fmt(filter?.min));
  const [max, setMax] = useState(fmt(filter?.max));

  function update(nextMin: string, nextMax: string) {
    const lo = parseAmount(nextMin);
    const hi = parseAmount(nextMax);
    onChange(lo === null && hi === null ? null : { kind: "range", min: lo, max: hi });
  }

  const box = "w-full rounded border border-border px-2 py-1.5 outline-none focus:border-navy";
  return (
    <div className="grid gap-2 p-3">
      <label className="grid gap-1">
        <span className="text-xs text-muted">At least</span>
        <input autoFocus inputMode="decimal" value={min} placeholder={money ? "e.g. 1M" : "e.g. 100,000"} className={box}
          onChange={(e) => { setMin(e.target.value); update(e.target.value, max); }} />
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-muted">At most</span>
        <input inputMode="decimal" value={max} placeholder={money ? "e.g. 5M" : "e.g. 500,000"} className={box}
          onChange={(e) => { setMax(e.target.value); update(min, e.target.value); }} />
      </label>
      <p className="text-xs text-muted">Leave either box empty for no limit.{money ? " You can type 250k or 1.5M." : ""}</p>
    </div>
  );
}

function DatesFilter({
  filter,
  onChange,
}: {
  filter: Extract<Filter, { kind: "dates" }> | undefined;
  onChange: (f: Filter | null) => void;
}) {
  const from = filter?.from ?? "";
  const to = filter?.to ?? "";
  function update(f: string, t: string) {
    onChange(!f && !t ? null : { kind: "dates", from: f || null, to: t || null });
  }
  const shortcuts = [
    { label: "This quarter", range: quarterRange(0) },
    { label: "Last quarter", range: quarterRange(-1) },
    { label: "This year", range: yearRange(0) },
    { label: "Last year", range: yearRange(-1) },
  ];
  const box = "w-full rounded border border-border px-2 py-1.5 outline-none focus:border-navy";
  return (
    <div className="grid gap-2 p-3">
      <div className="grid grid-cols-2 gap-1.5">
        {shortcuts.map((s) => {
          const on = from === s.range.from && to === s.range.to;
          return (
            <button key={s.label} type="button" onClick={() => update(s.range.from, s.range.to)}
              className={`rounded border px-2 py-1 text-xs ${on ? "border-navy bg-navy text-white" : "border-border hover:bg-hover"}`}>
              {s.label}
            </button>
          );
        })}
      </div>
      <label className="grid gap-1">
        <span className="text-xs text-muted">From</span>
        <input type="date" value={from} className={box} onChange={(e) => update(e.target.value, to)} />
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-muted">To</span>
        <input type="date" value={to} className={box} onChange={(e) => update(from, e.target.value)} />
      </label>
    </div>
  );
}
