import { Plus } from "lucide-react";
import { CommandLink, RefreshCommand } from "@/components/command-bar";
import { DataGrid } from "@/components/data-grid";
import { dealValue, formatMoney, pricePerSf } from "@/domain/stages";
import { listDeals, type DealView } from "@/server/deals";
import { myListLayout } from "@/server/list-layouts";

// Pipeline order, so sorting by stage reads BOV 1 → Under Contract rather than A–Z.
const STAGE_ORDER = ["BOV 1", "BOV 2", "Engaged", "Marketing", "Awarded", "Under Contract", "Closed", "Track", "Dead/Lost"];

export type ListView = { key: DealView | "archived"; label: string; href: string };

/** "2026-06-01" → "6/1/2026" */
function shortDate(iso: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
}

/**
 * Deal list shared by Active, Closed and Archive. `views` are the choices in the
 * title dropdown; `current` is the one showing.
 */
export async function DealList({ views, current }: { views: ListView[]; current: ListView["key"] }) {
  const archived = current === "archived";
  // Each list remembers its own columns; the Archive views share one layout.
  const listKey = current === "active" ? "deals-active" : current === "closed" ? "deals-closed" : "deals-archive";
  const [rows, saved] = await Promise.all([listDeals({ archived, view: archived ? "all" : current }), myListLayout(listKey)]);

  return (
    <DataGrid
      commands={
        <>
          <CommandLink href="/deals/new" icon={Plus}>
            New
          </CommandLink>
          <RefreshCommand />
        </>
      }
      views={views.map((v) => ({ label: v.label, href: v.href, active: v.key === current }))}
      defaultSort={{ key: "stageOrder", dir: "asc" }}
      listKey={listKey}
      savedColumns={saved}
      columns={[
        { key: "name", label: "Deal", kind: "link", hrefKey: "href" },
        { key: "stage", label: "Stage", sortKey: "stageOrder" },
        { key: "type", label: "Type" },
        { key: "valueLabel", label: "Value", sortKey: "value", type: "money" },
        { key: "properties", label: "Props", kind: "number" },
        { key: "sf", label: "SF", kind: "number" },
        { key: "leadAnalyst", label: "Lead analyst" },
        { key: "modifiedLabel", label: "Modified", sortKey: "modified", type: "date" },
        // Off until switched on under "Edit columns".
        { key: "reappsId", label: "REApps ID", defaultHidden: true },
        { key: "closeDateLabel", label: "Close date", sortKey: "closeDate", type: "date", defaultHidden: true },
        { key: "wonDateLabel", label: "Won date", sortKey: "wonDate", type: "date", defaultHidden: true },
        { key: "launchDateLabel", label: "Launch date", sortKey: "launchDate", type: "date", defaultHidden: true },
        { key: "sideA", label: "Seller side", multi: true, defaultHidden: true },
        { key: "sideB", label: "Buyer side", multi: true, defaultHidden: true },
        { key: "feeLabel", label: "Fee", sortKey: "fee", type: "money", defaultHidden: true },
        { key: "inHouseLabel", label: "In-house gross", sortKey: "inHouse", type: "money", defaultHidden: true },
        { key: "psfLabel", label: "Price / SF", sortKey: "psf", type: "money", defaultHidden: true },
        { key: "ios", label: "IOS Deal", defaultHidden: true },
        { key: "category", label: "Category", defaultHidden: true },
        { key: "cities", label: "City", multi: true, defaultHidden: true },
        { key: "states", label: "State", multi: true, defaultHidden: true },
        { key: "submarkets", label: "Submarket", multi: true, defaultHidden: true },
        { key: "leadBrokers", label: "Lead broker", multi: true, defaultHidden: true },
        { key: "team", label: "Deal team", multi: true, defaultHidden: true },
      ]}
      rows={rows.map((d) => {
        const v = dealValue(d);
        return {
          id: d.id,
          href: `/deals/${d.id}`,
          name: d.dealName,
          stage: d.stage,
          stageOrder: STAGE_ORDER.indexOf(d.stage),
          // IOS has its own column ("IOS Deal"); Type is the deal type only.
          type: d.dealType,
          value: v.value,
          valueLabel: formatMoney(v.value, true),
          properties: d.propertyCount,
          sf: d.totalSf || null,
          leadAnalyst: d.leadAnalyst,
          // Central-time "2026-10-06 14:05:00": sorts by time, filters by the local day.
          modified: d.lastModifiedAt.toLocaleString("sv-SE", { timeZone: "America/Chicago" }),
          modifiedLabel: d.lastModifiedAt.toLocaleDateString("en-US", { timeZone: "America/Chicago" }),
          reappsId: d.reappsId,
          closeDate: d.closeDate,
          closeDateLabel: shortDate(d.closeDate),
          wonDate: d.wonDate,
          wonDateLabel: shortDate(d.wonDate),
          launchDate: d.launchDate,
          launchDateLabel: shortDate(d.launchDate),
          sideA: d.sideA,
          sideB: d.sideB,
          fee: d.totalCommission === null ? null : Number(d.totalCommission),
          feeLabel: formatMoney(d.totalCommission === null ? null : Number(d.totalCommission)),
          inHouse: d.inHouseGross === null ? null : Number(d.inHouseGross),
          inHouseLabel: formatMoney(d.inHouseGross === null ? null : Number(d.inHouseGross)),
          psf: pricePerSf(v.value, d.totalSf),
          psfLabel: formatMoney(pricePerSf(v.value, d.totalSf)),
          ios: d.isIos ? "Yes" : null,
          category: d.category,
          cities: d.cities,
          states: d.states,
          submarkets: d.submarkets,
          leadBrokers: d.leadBrokers,
          team: d.team,
        };
      })}
    />
  );
}
