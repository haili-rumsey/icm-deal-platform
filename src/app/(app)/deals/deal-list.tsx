import { Plus } from "lucide-react";
import { CommandBar, CommandLink, RefreshCommand } from "@/components/command-bar";
import { DataGrid } from "@/components/data-grid";
import { dealValue, formatMoney } from "@/domain/stages";
import { listDeals, type DealView } from "@/server/deals";

// Pipeline order, so sorting by stage reads BOV 1 → Under Contract rather than A–Z.
const STAGE_ORDER = ["BOV 1", "BOV 2", "Engaged", "Marketing", "Awarded", "Under Contract", "Closed", "Track", "Dead/Lost"];

export type ListView = { key: DealView | "archived"; label: string; href: string };

/**
 * Deal list shared by Active, Closed and Archive. `views` are the choices in the
 * title dropdown; `current` is the one showing.
 */
export async function DealList({ views, current }: { views: ListView[]; current: ListView["key"] }) {
  const archived = current === "archived";
  const rows = await listDeals({ archived, view: archived ? "all" : current });

  return (
    <>
      <CommandBar>
        <CommandLink href="/deals/new" icon={Plus}>
          New
        </CommandLink>
        <RefreshCommand />
      </CommandBar>
      <DataGrid
        views={views.map((v) => ({ label: v.label, href: v.href, active: v.key === current }))}
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
