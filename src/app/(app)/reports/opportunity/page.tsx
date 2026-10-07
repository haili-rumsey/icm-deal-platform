import { DEAL_SUBTYPES, DEAL_TYPES, OPPORTUNITY_TYPES } from "@/domain/options";
import { parsePeriod, periodChoices, summarize, type GroupBy, type ReportDeal } from "@/domain/opportunity-report";
import { dealValue, formatMoney } from "@/domain/stages";
import { searchParam } from "@/lib/params";
import { listDeals } from "@/server/deals";
import { myListLayout } from "@/server/list-layouts";
import { OpportunityReport } from "./opportunity-report";

const num = (v: string | null) => (v === null ? null : Number(v));
const day = (iso: string | null) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
};

/**
 * Opportunity report (PRD §6): closed deals in a calendar period, summed by deal
 * type (subtypes underneath) or by opportunity type. Click a row for its deals.
 */
export default async function OpportunityReportPage({ searchParams }: PageProps<"/reports/opportunity">) {
  const sp = await searchParams;
  const by: GroupBy = searchParam(sp.by) === "opportunity" ? "opportunity" : "type";
  const [closed, saved] = await Promise.all([listDeals({ view: "closed" }), myListLayout("report-opportunity")]);

  const earliest = closed.reduce<string | null>((m, d) => (d.closeDate && (!m || d.closeDate < m) ? d.closeDate : m), null);
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const choices = periodChoices(earliest, today);
  const period = parsePeriod(searchParam(sp.period)) ?? choices.current;

  const inPeriod = closed.filter((d) => d.closeDate && d.closeDate >= period.from && d.closeDate <= period.to);
  const noCloseDate = closed.filter((d) => !d.closeDate).length;

  const reportDeals: ReportDeal[] = inPeriod.map((d) => ({
    id: d.id,
    isIos: d.isIos,
    dealType: d.dealType,
    dealSubtype: d.dealSubtype,
    opportunityType: d.opportunityType,
    closeDate: d.closeDate,
    value: dealValue(d).value,
    fee: num(d.totalCommission),
    sf: d.totalSf || null,
    acres: d.totalAcres,
  }));
  const summary = summarize(reportDeals, by, { dealTypes: DEAL_TYPES, subtypes: DEAL_SUBTYPES, opportunityTypes: OPPORTUNITY_TYPES });

  return (
    <OpportunityReport
      by={by}
      period={period}
      choices={choices}
      summary={summary}
      noCloseDate={noCloseDate}
      savedColumns={saved}
      dealRows={inPeriod.map((d, i) => {
        const r = reportDeals[i];
        return {
          id: d.id,
          href: `/deals/${d.id}`,
          name: d.dealName,
          closeDate: d.closeDate,
          closeLabel: day(d.closeDate),
          type: d.dealType,
          subtype: d.dealSubtype,
          opportunityType: d.opportunityType,
          value: r.value,
          valueLabel: formatMoney(r.value, true),
          fee: r.fee,
          feeLabel: formatMoney(r.fee),
          sf: r.sf,
          acres: r.acres,
          ios: d.isIos ? "Yes" : null,
          category: d.category,
          cities: d.cities,
          states: d.states,
          seller: d.sideA,
          buyer: d.sideB,
          leadBrokers: d.leadBrokers,
          reappsId: d.reappsId,
        };
      })}
    />
  );
}
