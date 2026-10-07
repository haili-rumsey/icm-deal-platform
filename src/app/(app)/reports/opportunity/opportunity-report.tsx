"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, FileSpreadsheet, List } from "lucide-react";
import { CommandBar, CommandButton, CommandDivider, RefreshCommand } from "@/components/command-bar";
import { DataGrid, type Column, type Row } from "@/components/data-grid";
import { addListSheet, downloadWorkbook, newWorkbook } from "@/components/data-grid-export";
import { BackCommand } from "@/components/record-page";
import type { GroupBy, Period, SummaryRow } from "@/domain/opportunity-report";
import { formatMoney } from "@/domain/stages";

const DEAL_COLUMNS: Column[] = [
  { key: "name", label: "Deal", kind: "link", hrefKey: "href" },
  { key: "closeLabel", label: "Close date", sortKey: "closeDate", type: "date" },
  { key: "type", label: "Type" },
  { key: "subtype", label: "Subtype" },
  { key: "opportunityType", label: "Opportunity type" },
  { key: "valueLabel", label: "Value", sortKey: "value", type: "money" },
  { key: "feeLabel", label: "Fee", sortKey: "fee", type: "money" },
  { key: "sf", label: "SF", kind: "number" },
  { key: "acres", label: "AC", kind: "number" },
  { key: "ios", label: "IOS Deal", defaultHidden: true },
  { key: "category", label: "Category", defaultHidden: true },
  { key: "cities", label: "City", multi: true, defaultHidden: true },
  { key: "states", label: "State", multi: true, defaultHidden: true },
  { key: "seller", label: "Seller side", multi: true, defaultHidden: true },
  { key: "buyer", label: "Buyer side", multi: true, defaultHidden: true },
  { key: "leadBrokers", label: "Lead broker", multi: true, defaultHidden: true },
  { key: "reappsId", label: "REApps ID", defaultHidden: true },
];

const acres = (v: number | null) => (v === null ? "" : v.toLocaleString("en-US", { maximumFractionDigits: 2 }));
const whole = (v: number | null) => (v === null ? "" : v.toLocaleString("en-US"));

export function OpportunityReport({
  by,
  period,
  choices,
  summary,
  noCloseDate,
  dealRows,
  savedColumns,
}: {
  by: GroupBy;
  period: Period;
  choices: { current: Period; quarters: Period[]; years: Period[] };
  summary: { rows: SummaryRow[]; core: SummaryRow; ios: SummaryRow; total: SummaryRow };
  noCloseDate: number;
  dealRows: Row[];
  savedColumns: string[] | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState<Set<string>>(new Set());
  // Summary first; the deals behind it open on request (a row click or "Show deals").
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const drill = useRef<HTMLDivElement>(null);
  const [scrollTo, setScrollTo] = useState(0);
  useEffect(() => {
    if (scrollTo) drill.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [scrollTo]);
  function show(id: string) {
    setSelectedId(id);
    setScrollTo((n) => n + 1);
  }
  const [exporting, setExporting] = useState(false);
  const isCustom = !choices.quarters.some((q) => q.key === period.key) && !choices.years.some((y) => y.key === period.key);
  const [custom, setCustom] = useState(isCustom ? { from: period.from, to: period.to } : null);

  function go(next: { period?: string; by?: GroupBy }) {
    const params = new URLSearchParams({ period: next.period ?? period.key, by: next.by ?? by });
    setSelectedId(null);
    router.push(`${pathname}?${params}`);
  }

  const all = [summary.total, summary.core, summary.ios, ...summary.rows.flatMap((r) => [r, ...r.children])];
  const selected = selectedId ? (all.find((r) => r.id === selectedId) ?? summary.total) : null;
  const ids = new Set(selected?.dealIds ?? []);
  const groupWord = by === "type" ? "Deal type" : "Opportunity type";

  async function exportReport() {
    setExporting(true);
    try {
      const wb = await newWorkbook();
      const ws = wb.addWorksheet("Summary");
      ws.addRow([`Opportunity report — ${period.label}`]).font = { bold: true, size: 14, color: { argb: "FF002F6C" } };
      ws.addRow([`Closed deals by ${groupWord.toLowerCase()} · close dates ${period.from} to ${period.to}`]);
      ws.addRow([]);
      const head = ws.addRow([groupWord, "# closed", "Total value", "Total fee", "Total SF", "Total AC"]);
      head.eachCell((c) => {
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF002F6C" } };
      });
      const line = (r: SummaryRow, label: string, bold = false) => {
        const x = ws.addRow([label, r.count, r.value, r.fee, r.sf, r.acres]);
        if (bold) x.font = { bold: true };
      };
      for (const r of summary.rows) {
        line(r, r.label, true);
        for (const c of r.children) line(c, `    ${c.label}`);
      }
      line(summary.core, summary.core.label, true);
      line(summary.ios, summary.ios.label, true);
      line(summary.total, "Total", true);
      ws.getColumn(1).width = 28;
      ws.getColumn(2).numFmt = "#,##0";
      ws.getColumn(3).numFmt = '"$"#,##0';
      ws.getColumn(4).numFmt = '"$"#,##0';
      ws.getColumn(5).numFmt = "#,##0";
      ws.getColumn(6).numFmt = "#,##0.00";
      for (const i of [2, 3, 4, 5, 6]) ws.getColumn(i).width = 16;
      addListSheet(wb, "Deals", { shown: DEAL_COLUMNS.filter((c) => !c.defaultHidden), all: DEAL_COLUMNS, rows: dealRows });
      await downloadWorkbook(wb, `Opportunity report ${period.label.replace(/\//g, "-")}`);
    } finally {
      setExporting(false);
    }
  }

  const cell = "px-4 py-2.5 text-right tabular-nums whitespace-nowrap";
  function summaryRow(r: SummaryRow, opts: { total?: boolean; subtotal?: boolean } = {}) {
    const expandable = r.children.length > 0;
    const isOpen = open.has(r.id);
    const isSelected = selectedId === r.id;
    return (
      <tr
        key={r.id}
        onClick={() => show(r.id)}
        aria-selected={isSelected}
        className={`cursor-pointer border-b border-border ${
          opts.total ? "border-t-2 border-t-navy bg-navy/5 font-bold" : opts.subtotal ? "bg-background font-semibold italic" : r.level === 0 ? "font-semibold" : ""
        } ${
          isSelected ? "bg-blue/10 outline outline-2 -outline-offset-2 outline-blue" : "hover:bg-background"
        }`}
      >
        <td className={`py-2.5 pr-4 ${r.level === 1 ? "pl-12" : "pl-5"}`}>
          <span className="inline-flex items-center gap-1.5">
            {expandable ? (
              <button
                type="button"
                aria-label={isOpen ? `Hide ${r.label} subtypes` : `Show ${r.label} subtypes`}
                aria-expanded={isOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  const next = new Set(open);
                  if (isOpen) next.delete(r.id);
                  else next.add(r.id);
                  setOpen(next);
                }}
                className="rounded p-0.5 text-navy hover:bg-hover"
              >
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            ) : (
              r.level === 0 && !opts.total && !opts.subtotal && <span className="inline-block w-5" />
            )}
            <span className={r.label === "Not set" ? "italic text-muted" : ""}>{r.label}</span>
          </span>
        </td>
        <td className={cell}>{r.count}</td>
        <td className={cell}>{formatMoney(r.value, true)}</td>
        <td className={cell}>{formatMoney(r.fee)}</td>
        <td className={cell}>{whole(r.sf)}</td>
        <td className={cell}>{acres(r.acres)}</td>
      </tr>
    );
  }

  return (
    <>
      <CommandBar>
        <BackCommand fallbackHref="/deals" />
        <RefreshCommand />
        <CommandDivider />
        <CommandButton
          icon={List}
          onClick={() => (selected ? setSelectedId(null) : show("total"))}
          disabled={summary.total.count === 0}
          aria-pressed={!!selected}
        >
          {selected ? "Hide deals" : "Show deals"}
        </CommandButton>
        <CommandButton icon={FileSpreadsheet} onClick={exportReport} disabled={exporting}>
          {exporting ? "Exporting…" : "Export to Excel"}
        </CommandButton>
      </CommandBar>

      <div className="m-3 rounded-md border border-border bg-card shadow-sm sm:m-5">
        <div className="flex flex-col gap-3 px-4 pt-4 sm:px-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-serif text-lg">Opportunity report</h1>
            <p className="text-sm text-muted">Closed deals in {period.label}, by {groupWord.toLowerCase()}. Click a row, or Show deals, to see the deals behind it.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Period</span>
              <select
                value={custom ? "custom" : period.key}
                onChange={(e) => {
                  if (e.target.value === "custom") return setCustom({ from: period.from, to: period.to });
                  setCustom(null);
                  go({ period: e.target.value });
                }}
                className="rounded border border-border bg-card px-2 py-1.5"
              >
                <optgroup label="Quarters">
                  {choices.quarters.map((q) => (
                    <option key={q.key} value={q.key}>
                      {q.label}
                      {q.key === choices.current.key ? " (this quarter)" : ""}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Years">
                  {choices.years.map((y) => (
                    <option key={y.key} value={y.key}>
                      {y.label}
                    </option>
                  ))}
                </optgroup>
                <option value="custom">Custom dates…</option>
              </select>
            </label>
            {custom && (
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (custom.from && custom.to) go({ period: `${custom.from}_${custom.to}` });
                }}
              >
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted">From</span>
                  <input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="rounded border border-border px-2 py-1" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted">To</span>
                  <input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="rounded border border-border px-2 py-1" />
                </label>
                <button type="submit" disabled={!custom.from || !custom.to || custom.from > custom.to} className="rounded bg-navy px-3 py-1.5 text-white disabled:opacity-50">
                  Show
                </button>
              </form>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted">Group by</span>
              <div role="group" aria-label="Group by" className="flex overflow-hidden rounded border border-border">
                {(["type", "opportunity"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={by === g}
                    onClick={() => go({ by: g })}
                    className={`px-3 py-1.5 ${by === g ? "bg-navy text-white" : "hover:bg-hover"}`}
                  >
                    {g === "type" ? "Deal type" : "Opportunity type"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-2 font-semibold">{groupWord}</th>
                {["# closed", "Total value", "Total fee", "Total SF", "Total AC"].map((h) => (
                  <th key={h} className="px-4 py-2 text-right font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((r) => (
                <Fragment key={r.id}>
                  {summaryRow(r)}
                  {open.has(r.id) && r.children.map((c) => summaryRow(c))}
                </Fragment>
              ))}
              {summaryRow(summary.core, { subtotal: true })}
              {summary.ios.count > 0 && summaryRow(summary.ios)}
              {summaryRow(summary.total, { total: true })}
            </tbody>
          </table>
          {summary.total.count === 0 && <p className="px-5 py-8 text-center text-sm text-muted">No deals closed in {period.label}.</p>}
        </div>
        {noCloseDate > 0 && (
          <p className="px-5 py-3 text-xs text-muted">
            {noCloseDate} closed deal{noCloseDate === 1 ? " has" : "s have"} no close date and {noCloseDate === 1 ? "isn't" : "aren't"} counted in any period.
          </p>
        )}
      </div>

      <div ref={drill} className="scroll-mt-14" />
      {selected && (
        <DataGrid
          key={`${period.key}-${by}-${selected.id}`}
          embedded
          views={[
            {
              label: selected.id === "total" ? `All deals closed in ${period.label}` : `${selected.level === 1 ? selected.id.replace("/", " → ") : selected.label} · ${period.label}`,
              href: "#",
              active: true,
            },
          ]}
          listKey="report-opportunity"
          savedColumns={savedColumns}
          defaultSort={{ key: "closeDate", dir: "desc" }}
          columns={DEAL_COLUMNS}
          rows={dealRows.filter((r) => ids.has(String(r.id)))}
        />
      )}
    </>
  );
}
