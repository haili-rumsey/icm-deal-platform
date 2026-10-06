import type { Column, Row } from "./data-grid";
import { displayText, isoDay, valueKey, valueType } from "./data-grid-filters";

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
 * real Excel values, not text. ExcelJS loads only when someone exports.
 */
export async function exportToExcel({ title, shown, all, rows }: { title: string; shown: Column[]; all: Column[]; rows: Row[] }) {
  const { default: ExcelJS } = await import("exceljs");
  const showing = new Set(shown.map((c) => c.key));
  const columns = [...shown, ...all.filter((c) => !showing.has(c.key))];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(title.slice(0, 31).replace(/[\\/?*[\]:]/g, " "), { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => {
    const t = valueType(c);
    if (t === "text") return { header: c.label, key: c.key, width: 24 };
    const fractional = rows.some((r) => {
      const v = r[valueKey(c)];
      return typeof v === "number" && !Number.isInteger(v);
    });
    return { header: c.label, key: c.key, width: 14, style: { numFmt: format(t, fractional) } };
  });

  for (const r of rows) {
    ws.addRow(
      columns.map((c) => {
        const t = valueType(c);
        const v = r[valueKey(c)];
        if (t === "date") {
          const day = isoDay(v);
          return day ? new Date(`${day}T00:00:00Z`) : null;
        }
        if (t === "money" || t === "number") return typeof v === "number" ? v : null;
        return displayText(r[c.key], c.kind) || null;
      }),
    );
  }

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF002F6C" } };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title} ${today()}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
