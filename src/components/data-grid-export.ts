import type { Column, Row } from "./data-grid";
import { displayText, isoDay, valueKey, valueType } from "./data-grid-filters";
import { buildBlocks, countLabel, type Grouping, type Totals } from "./data-grid-groups";

/** Excel number formats; cents and decimals only for columns that have them (e.g. price per SF, acres). */
function format(t: Exclude<ReturnType<typeof valueType>, "text">, fractional: boolean) {
  if (t === "date") return "m/d/yyyy";
  return (t === "money" ? '"$"' : "") + (fractional ? "#,##0.00" : "#,##0");
}

/** Today's date in Central time as "2026-10-06", for the file name. */
function today() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

/**
 * Downloads the rows on screen (after filters, Quick find and sort) as an Excel
 * file. Every column goes in: the ones showing first, in screen order, then the
 * rest so people can delete what they don't need. Money, numbers and dates are
 * real Excel values, not text. A grouped list (the Pipeline report) keeps its
 * sections, subtotals and grand total. ExcelJS loads only when someone exports.
 */
export async function exportToExcel(list: ListSheet & { title: string }) {
  const wb = await newWorkbook();
  addListSheet(wb, list.title, list);
  await downloadWorkbook(wb, list.title);
}

type ListSheet = { shown: Column[]; all: Column[]; rows: Row[]; grouping?: Grouping; keepEmpty?: boolean };
export type Workbook = InstanceType<(typeof import("exceljs"))["Workbook"]>;

/** ExcelJS loads only when someone exports. */
export async function newWorkbook(): Promise<Workbook> {
  const { default: ExcelJS } = await import("exceljs");
  return new ExcelJS.Workbook();
}

/** Excel's rules for sheet names: 31 characters, none of \ / ? * [ ] : */
export function sheetName(name: string) {
  return name.slice(0, 31).replace(/[\\/?*[\]:]/g, " ");
}

/** Adds one list as a sheet (see exportToExcel). */
export function addListSheet(wb: Workbook, name: string, { shown, all, rows, grouping, keepEmpty = true }: ListSheet) {
  const showing = new Set(shown.map((c) => c.key));
  const columns = [...shown, ...all.filter((c) => !showing.has(c.key))];

  const ws = wb.addWorksheet(sheetName(name), { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => {
    const t = valueType(c);
    if (t === "text") return { header: c.label, key: c.key, width: 24 };
    const fractional = rows.some((r) => {
      const v = r[valueKey(c)];
      return typeof v === "number" && !Number.isInteger(v);
    });
    return { header: c.label, key: c.key, width: 14, style: { numFmt: format(t, fractional) } };
  });

  const cells = (r: Row) =>
    columns.map((c) => {
      const t = valueType(c);
      const v = r[valueKey(c)];
      if (t === "date") {
        const day = isoDay(v);
        return day ? new Date(`${day}T00:00:00Z`) : null;
      }
      if (t === "money" || t === "number") return typeof v === "number" ? v : null;
      return displayText(r[c.key], c.kind) || null;
    });

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF002F6C" } };

  if (!grouping) {
    for (const r of rows) ws.addRow(cells(r));
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  } else {
    const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
    // Style every cell across the sheet's width, not only the ones holding a value.
    const across = (row: ReturnType<typeof ws.addRow>, style: (cell: ReturnType<typeof row.getCell>) => void) => {
      for (let i = 1; i <= columns.length; i++) style(row.getCell(i));
    };
    const totals = (label: string, t: Totals) =>
      columns.map((c, i) => (i === 0 ? `${label} · ${countLabel(t.count, grouping.unit)}` : c.total ? (t.sums[c.key] ?? null) : null));
    for (const b of buildBlocks(rows, all, grouping, keepEmpty)) {
      if (b.kind === "total") {
        const row = ws.addRow(totals(b.title, b.totals));
        across(row, (cell) => {
          cell.font = { bold: true };
          cell.fill = fill("FFDCE3EE");
          cell.border = { top: { style: "medium", color: { argb: "FF002F6C" } }, bottom: { style: "medium", color: { argb: "FF002F6C" } } };
        });
        ws.addRow([]);
        continue;
      }
      const head = ws.addRow([b.note ? `${b.title}  (date shown: ${b.note})` : b.title]);
      across(head, (cell) => {
        cell.font = { bold: true, size: 12, color: { argb: "FF002F6C" } };
        cell.fill = fill("FFE7E7E3");
      });
      for (const r of b.rows) ws.addRow(cells(r));
      const sub = ws.addRow(totals("Subtotal", b.totals));
      across(sub, (cell) => {
        cell.font = { bold: true };
        cell.border = { top: { style: "thin", color: { argb: "FF8A8D8F" } } };
      });
      ws.addRow([]);
    }
  }
}

/** Saves the workbook to the person's downloads as "<title> <today>.xlsx". */
export async function downloadWorkbook(wb: Workbook, title: string) {
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title} ${today()}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
