import { RefreshCommand } from "@/components/command-bar";
import { DataGrid } from "@/components/data-grid";
import { shortDay } from "@/components/data-grid-filters";
import { listCleanup } from "@/server/cleanup";
import { myListLayout } from "@/server/list-layouts";

/**
 * Needs cleanup (Haili, 1.6): records waiting to be filled in — deals with no property
 * (the active-import back-fill list among them), properties without a Google match,
 * companies marked "no website" and contacts marked "no email". Fixed records drop off.
 */
export default async function CleanupReportPage() {
  const [rows, saved] = await Promise.all([listCleanup(), myListLayout("report-cleanup")]);

  return (
    <DataGrid
      commands={<RefreshCommand />}
      views={[{ label: "Needs cleanup", href: "/reports/cleanup", active: true }]}
      listKey="report-cleanup"
      savedColumns={saved}
      defaultSort={{ key: "name", dir: "asc" }}
      grouping={{
        by: "kind",
        unit: "record",
        totalLabel: "Needs cleanup",
        sections: [
          { id: "Deal", title: "Deals with no property" },
          { id: "Property", title: "Properties with no Google match" },
          { id: "Company", title: "Companies marked no website" },
          { id: "Contact", title: "Contacts marked no email" },
        ],
      }}
      emptyText="Nothing needs cleanup."
      columns={[
        { key: "name", label: "Record", kind: "link", hrefKey: "href" },
        { key: "issue", label: "What's needed" },
        { key: "details", label: "Details" },
        { key: "context", label: "Stage / deals" },
        { key: "modifiedLabel", label: "Last modified", sortKey: "modifiedAt", type: "date" },
        { key: "kind", label: "Type", defaultHidden: true },
      ]}
      rows={rows.map((r) => ({
        id: `${r.kind}-${r.id}`,
        kind: r.kind,
        name: r.name,
        href: r.href,
        issue: r.issue,
        details: r.details,
        context: r.context,
        modifiedAt: r.modifiedAt.toISOString().slice(0, 10),
        modifiedLabel: shortDay(r.modifiedAt.toISOString().slice(0, 10)),
      }))}
    />
  );
}
