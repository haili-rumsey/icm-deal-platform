import { Plus } from "lucide-react";
import { CommandBar, CommandLink, RefreshCommand } from "@/components/command-bar";
import { DataGrid } from "@/components/data-grid";
import { dealValue, formatMoney } from "@/domain/stages";
import { searchParam } from "@/lib/params";
import { listDeals, type DealView } from "@/server/deals";

const VIEWS: { key: DealView; label: string }[] = [
  { key: "active", label: "Active pipeline" },
  { key: "track", label: "Track (dormant)" },
  { key: "closed", label: "Closed deals" },
  { key: "dead", label: "Dead / Lost" },
  { key: "all", label: "All deals" },
];

// Pipeline order, so sorting by stage reads BOV 1 → Under Contract rather than A–Z.
const STAGE_ORDER = ["BOV 1", "BOV 2", "Engaged", "Marketing", "Awarded", "Under Contract", "Closed", "Track", "Dead/Lost"];

export default async function DealsPage({ searchParams }: PageProps<"/deals">) {
  const sp = await searchParams;
  const archived = searchParam(sp.archived) === "1";
  const view = (VIEWS.find((v) => v.key === searchParam(sp.view))?.key ?? "active") as DealView;
  const rows = await listDeals({ archived, view });

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
          ...VIEWS.map((v) => ({ label: v.label, href: `/deals?view=${v.key}`, active: !archived && view === v.key })),
          { label: "Archived deals", href: "/deals?archived=1", active: archived },
        ]}
        defaultSort={{ key: "stageOrder", dir: "asc" }}
        columns={[
          { key: "name", label: "Deal", kind: "link", hrefKey: "href" },
          { key: "stage", label: "Stage", sortKey: "stageOrder" },
          { key: "type", label: "Type" },
          { key: "valueLabel", label: "Value", sortKey: "value" },
          { key: "properties", label: "Props", kind: "number" },
          { key: "sf", label: "SF", kind: "number" },
          { key: "leadAnalyst", label: "Lead analyst" },
          { key: "modifiedLabel", label: "Modified", sortKey: "modified" },
        ]}
        rows={rows.map((d) => {
          const v = dealValue(d);
          return {
            id: d.id,
            href: `/deals/${d.id}`,
            name: d.dealName,
            stage: d.stage,
            stageOrder: STAGE_ORDER.indexOf(d.stage),
            type: [d.dealType, d.isIos ? "IOS" : null].filter(Boolean).join(" · "),
            value: v.value,
            valueLabel: formatMoney(v.value, true),
            properties: d.propertyCount,
            sf: d.totalSf || null,
            leadAnalyst: d.leadAnalyst,
            modified: d.lastModifiedAt.toISOString(),
            modifiedLabel: d.lastModifiedAt.toLocaleDateString("en-US", { timeZone: "America/Chicago" }),
          };
        })}
      />
    </>
  );
}
