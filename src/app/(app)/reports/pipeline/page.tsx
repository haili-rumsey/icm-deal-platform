import { RefreshCommand } from "@/components/command-bar";
import { DataGrid } from "@/components/data-grid";
import { shortDay } from "@/components/data-grid-filters";
import { ACTIVE_STAGES, BUYER_STAGES, dealValue, FEE_STAGES, formatMoney, PIPELINE_KEY_DATE } from "@/domain/stages";
import { listDeals } from "@/server/deals";
import { myListLayout } from "@/server/list-layouts";

const day = (iso: string | null) => (iso ? shortDay(iso) : null);
const money = (v: string | null) => (v === null ? null : Number(v));

/**
 * The weekly meeting's report: every active deal, grouped by stage (BOV 1 →
 * Under Contract) with subtotals, then Track on its own — never in the totals.
 * Each deal leads with the date that matters at its stage. Lead analyst is the
 * only team field shown by default (PRD §6).
 */
export default async function PipelineReportPage() {
  const [deals, saved] = await Promise.all([listDeals({ view: "pipeline" }), myListLayout("report-pipeline")]);

  return (
    <DataGrid
      commands={<RefreshCommand />}
      views={[{ label: "Pipeline report", href: "/reports/pipeline", active: true }]}
      listKey="report-pipeline"
      savedColumns={saved}
      defaultSort={{ key: "keyDate", dir: "asc" }}
      grouping={{
        by: "stage",
        unit: "deal",
        totalLabel: "Active pipeline",
        sections: [...ACTIVE_STAGES, "Track" as const].map((s) => ({
          id: s,
          title: s === "Track" ? "Track (dormant — not in pipeline totals)" : s,
          note: PIPELINE_KEY_DATE[s]?.label,
          apart: s === "Track",
        })),
      }}
      emptyText="No active deals."
      columns={[
        { key: "keyDateLabel", label: "Key date", sortKey: "keyDate", type: "date" },
        { key: "leadAnalyst", label: "Lead analyst", titleKey: "leadAnalystFull" },
        { key: "name", label: "Deal", kind: "link", hrefKey: "href" },
        { key: "seller", label: "Seller", multi: true },
        { key: "buyer", label: "Buyer", multi: true },
        { key: "cities", label: "City", multi: true },
        { key: "submarkets", label: "Submarket", multi: true },
        { key: "sf", label: "SF", kind: "number", total: true },
        { key: "valueLabel", label: "Total deal value", sortKey: "value", type: "money", total: true },
        { key: "feeLabel", label: "Fee", sortKey: "fee", type: "money", total: true },
        // Off until switched on under "Edit columns".
        { key: "stage", label: "Stage", defaultHidden: true },
        { key: "furthest", label: "Furthest stage", defaultHidden: true },
        { key: "type", label: "Type", defaultHidden: true },
        { key: "subtype", label: "Subtype", defaultHidden: true },
        { key: "opportunityType", label: "Opportunity type", defaultHidden: true },
        { key: "category", label: "Category", defaultHidden: true },
        { key: "ios", label: "IOS Deal", defaultHidden: true },
        { key: "states", label: "State", multi: true, defaultHidden: true },
        { key: "properties", label: "Props", kind: "number", defaultHidden: true },
        { key: "leadBrokers", label: "Lead broker", multi: true, defaultHidden: true },
        { key: "team", label: "Deal team", multi: true, defaultHidden: true },
        { key: "pitchDueLabel", label: "Pitch due date", sortKey: "pitchDueDate", type: "date", defaultHidden: true },
        { key: "pitchLabel", label: "Pitch date", sortKey: "pitchDate", type: "date", defaultHidden: true },
        { key: "wonLabel", label: "Won date", sortKey: "wonDate", type: "date", defaultHidden: true },
        { key: "launchLabel", label: "Launch date", sortKey: "launchDate", type: "date", defaultHidden: true },
        { key: "cfoLabel", label: "Call for offers", sortKey: "callForOffersDate", type: "date", defaultHidden: true },
        { key: "awardedLabel", label: "Awarded date", sortKey: "awardedDate", type: "date", defaultHidden: true },
        { key: "ddLabel", label: "DD expiration", sortKey: "ddExpirationDate", type: "date", defaultHidden: true },
        { key: "closeLabel", label: "Close date", sortKey: "closeDate", type: "date", defaultHidden: true },
        { key: "followUpLabel", label: "Follow-up date", sortKey: "followUpDate", type: "date", defaultHidden: true },
      ]}
      rows={deals.map((d) => {
        const keyField = PIPELINE_KEY_DATE[d.stage]?.field;
        const keyDate = keyField ? d[keyField] : null;
        const value = dealValue(d).value;
        // Fee from Engaged on; buyer once one is selected (Haili's spec).
        const fee = FEE_STAGES.includes(d.stage) ? money(d.totalCommission) : null;
        return {
          id: d.id,
          href: `/deals/${d.id}`,
          stage: d.stage,
          furthest: d.furthestStage,
          keyDate,
          keyDateLabel: day(keyDate),
          leadAnalyst: d.leadAnalystShort,
          leadAnalystFull: d.leadAnalyst,
          name: d.dealName,
          seller: d.sideA,
          buyer: BUYER_STAGES.includes(d.stage) ? d.sideB : null,
          cities: d.cities,
          submarkets: d.submarkets,
          sf: d.totalSf || null,
          value,
          valueLabel: formatMoney(value, true),
          fee,
          feeLabel: formatMoney(fee),
          type: d.dealType,
          subtype: d.dealSubtype,
          opportunityType: d.opportunityType,
          category: d.category,
          ios: d.isIos ? "Yes" : null,
          states: d.states,
          properties: d.propertyCount,
          leadBrokers: d.leadBrokers,
          team: d.team,
          pitchDueDate: d.pitchDueDate,
          pitchDueLabel: day(d.pitchDueDate),
          pitchDate: d.pitchDate,
          pitchLabel: day(d.pitchDate),
          wonDate: d.wonDate,
          wonLabel: day(d.wonDate),
          launchDate: d.launchDate,
          launchLabel: day(d.launchDate),
          callForOffersDate: d.callForOffersDate,
          cfoLabel: day(d.callForOffersDate),
          awardedDate: d.awardedDate,
          awardedLabel: day(d.awardedDate),
          ddExpirationDate: d.ddExpirationDate,
          ddLabel: day(d.ddExpirationDate),
          closeDate: d.closeDate,
          closeLabel: day(d.closeDate),
          followUpDate: d.followUpDate,
          followUpLabel: day(d.followUpDate),
        };
      })}
    />
  );
}
