import { Plus } from "lucide-react";
import { CommandBar, CommandLink, RefreshCommand } from "@/components/command-bar";
import { DataGrid } from "@/components/data-grid";
import { searchParam } from "@/lib/params";
import { listDeals } from "@/server/deals";

export default async function DealsPage({ searchParams }: PageProps<"/deals">) {
  const archived = searchParam((await searchParams).archived) === "1";
  const rows = await listDeals({ archived });

  return (
    <>
      <CommandBar>
        <CommandLink href="/deals/new" icon={Plus}>
          New
        </CommandLink>
        <RefreshCommand />
      </CommandBar>
      <DataGrid
        views={[
          { label: "Active deals", href: "/deals", active: !archived },
          { label: "Archived deals", href: "/deals?archived=1", active: archived },
        ]}
        defaultSort={{ key: "modified", dir: "desc" }}
        columns={[
          { key: "name", label: "Deal", kind: "link", hrefKey: "href" },
          { key: "type", label: "Type" },
          { key: "category", label: "Category" },
          { key: "desk", label: "Desk" },
          { key: "properties", label: "Properties", kind: "number" },
          { key: "sf", label: "SF", kind: "number" },
          { key: "leadAnalyst", label: "Lead analyst" },
          { key: "modifiedLabel", label: "Modified", sortKey: "modified" },
        ]}
        rows={rows.map((d) => ({
          id: d.id,
          href: `/deals/${d.id}`,
          name: d.dealName,
          type: d.dealType,
          category: d.category,
          desk: d.isIos ? "IOS" : "",
          properties: d.propertyCount,
          sf: d.totalSf || null,
          leadAnalyst: d.leadAnalyst,
          modified: d.lastModifiedAt.toISOString(),
          modifiedLabel: d.lastModifiedAt.toLocaleDateString("en-US", { timeZone: "America/Chicago" }),
        }))}
      />
    </>
  );
}
