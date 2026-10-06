import { notFound } from "next/navigation";
import { requireUser } from "@/auth";
import { CommandBar, CommandDivider, RefreshCommand } from "@/components/command-bar";
import { FlagMark } from "@/components/data-grid";
import { Incomplete, Section } from "@/components/fields";
import {
  HousekeepingCommands,
  MainForm,
  ModifiedStamp,
  RecordFormProvider,
  RecordHeader,
  BackCommand,
  SaveCommand,
  Tabs,
} from "@/components/record-page";
import { partyLabel, type DealType } from "@/domain/options";
import { dealValue, formatMoney, pricePerSf } from "@/domain/stages";
import { searchParam } from "@/lib/params";
import { companyOptions } from "@/server/companies";
import { contactOptions, icmTeamOptions, streamPeopleOptions } from "@/server/contacts";
import { getDeal, isLockedFor, missingToClose } from "@/server/deals";
import { propertyOptions } from "@/server/properties";
import { moveStageAction, saveDeal } from "../actions";
import { DealDatesFields } from "../deal-dates-fields";
import { DealFields } from "../deal-fields";
import { DealFeeFields, DealMoneyFields } from "../deal-money-fields";
import { FeeVisibility } from "../fee-visibility";
import { DealTeamFields } from "../deal-team-fields";
import { PartiesSection, PropertiesSection, TeamSection } from "./sections";
import { StageBar } from "./stage-bar";

export default async function DealPage({ params, searchParams }: PageProps<"/deals/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  // Everything the page needs, fetched at once rather than one after another.
  const [user, data, streamPeople, icmTeam, companies, contacts, properties] = await Promise.all([
    requireUser(),
    getDeal(id),
    streamPeopleOptions(),
    icmTeamOptions(id),
    companyOptions(),
    contactOptions(),
    propertyOptions(),
  ]);
  if (!data) notFound();
  const { deal } = data;
  // The close-date prompt fills that one in, so leave it off the up-front list.
  const closeMissing = deal.stage === "Closed" ? [] : (await missingToClose(id)).filter((m) => m !== "close date");

  const value = dealValue(deal);
  // Prompted, never enforced.
  const type = deal.dealType as DealType | null;
  const missing = [
    !deal.dealType && "deal type",
    !deal.category && "category",
    data.properties.length === 0 && type !== "Consulting" && "properties",
    !data.parties.some((p) => p.side === "A") && (type ? partyLabel(type, "A").toLowerCase() : "side A party"),
    !data.team.some((t) => t.isLeadBroker) && "lead broker",
    !data.team.some((t) => t.isLeadAnalyst) && "lead analyst",
    value.missing,
  ].filter((m): m is string => !!m);

  const totalSf = data.properties.reduce((s, p) => s + (p.buildingSf ?? 0), 0);
  const names = (side: "A" | "B") =>
    [...new Set(data.parties.filter((p) => p.side === side).map((p) => p.companyName))].join(" / ");
  const addProperty = searchParam(sp.addProperty);
  const companyOpts = companies.map((c) => ({ id: c.id, name: c.name, hint: c.domain }));

  // Closed deals are read-only except for the three admins.
  const isClosed = deal.stage === "Closed";
  const locked = isLockedFor(deal.stage, user);
  const psf = pricePerSf(value.value, totalSf);

  return (
    <RecordFormProvider action={saveDeal.bind(null, id)}>
      <CommandBar>
        <BackCommand fallbackHref="/deals" />
        {!locked && <SaveCommand />}
        <RefreshCommand />
        {!locked && (
          <>
            <CommandDivider />
            <HousekeepingCommands kind="deal" id={id} archivedAt={deal.archivedAt} canDelete={user.isAdmin} />
          </>
        )}
      </CommandBar>
      <RecordHeader
        kindLabel="Deal"
        title={deal.dealName}
        subtitle={[deal.dealType, deal.dealSubtype, deal.category, deal.isIos && "IOS Deal"].filter(Boolean).join(" · ") || undefined}
        facts={[
          { label: "Stage", value: deal.stage },
          { label: value.source, value: formatMoney(value.value, true) },
          { label: "Price / SF", value: psf ? `$${psf.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : null },
          { label: partyLabel(type, "A"), value: names("A") },
          { label: partyLabel(type, "B"), value: names("B") },
          { label: "Total SF", value: totalSf ? totalSf.toLocaleString("en-US") : null },
          {
            label: "Submarket",
            value: [...new Set(data.properties.map((p) => p.submarket).filter(Boolean))].join(", "),
          },
          { label: "Lead broker", value: data.team.filter((t) => t.isLeadBroker).map((t) => t.name).join(", ") },
          { label: "Lead analyst", value: data.team.find((t) => t.isLeadAnalyst)?.name },
        ]}
        flags={
          <>
            {isClosed && (
              <span className="inline-flex items-center gap-1.5 rounded-sm bg-navy px-2 py-0.5 text-xs font-semibold text-white">
                Closed · {locked ? "read-only" : "admin can edit"}
              </span>
            )}
            {deal.archivedAt && <FlagMark label="Archived" />}
          </>
        }
      />
      <StageBar
        stage={deal.stage}
        dates={{
          pitchDate: deal.pitchDate,
          wonDate: deal.wonDate,
          launchDate: deal.launchDate,
          awardedDate: deal.awardedDate,
          closeDate: deal.closeDate,
          followUpDate: deal.followUpDate,
        }}
        companies={companyOpts}
        locked={locked}
        closeMissing={closeMissing}
        action={moveStageAction.bind(null, id)}
      />
      {locked && (
        <p className="border-b border-border bg-[#eef2f8] px-4 py-2 text-sm sm:px-5">
          This deal is closed, so it&apos;s read-only. Only Haili Rumsey, Seth Koschak and Matteson Hamilton can change it.
        </p>
      )}
      <Tabs
        initial={addProperty ? "properties" : undefined}
        tabs={[
          {
            id: "summary",
            label: "Summary",
            content: (
              <>
                <Incomplete missing={missing} />
                {/* Re-created whenever the deal changes on the server (stage bar, save), so the
                    form never holds stale values that a later Save would write back. */}
                <MainForm key={deal.lastModifiedAt.toISOString()} readOnly={locked}>
                  <Section title="Deal">
                    <DealFields deal={deal} />
                  </Section>
                  <Section title="Stage and dates">
                    <DealDatesFields deal={deal} companies={companyOpts} />
                  </Section>
                  <Section title="Pricing and underwriting">
                    <DealMoneyFields deal={deal} />
                  </Section>
                  <FeeVisibility
                    initialStage={deal.stage}
                    hasFeeData={[deal.totalCommission, deal.outsideCommission, deal.inHouseGross, deal.feeRate, deal.feeNotes].some((v) => v !== null && v !== "")}
                  >
                    <Section title="Fee">
                      <DealFeeFields deal={deal} />
                    </Section>
                  </FeeVisibility>
                  <Section title="Team">
                    <DealTeamFields
                      icmTeam={icmTeam}
                      streamPeople={streamPeople}
                      initial={{
                        teamIds: data.team.map((t) => t.contactId),
                        leadBrokerIds: data.team.filter((t) => t.isLeadBroker).map((t) => t.contactId),
                        leadAnalystId: data.team.find((t) => t.isLeadAnalyst)?.contactId ?? null,
                        referralId: deal.referralContactId,
                      }}
                    />
                  </Section>
                </MainForm>
                <ModifiedStamp at={deal.lastModifiedAt} by={data.modifiedByName} />
              </>
            ),
          },
          {
            id: "properties",
            label: `Properties (${data.properties.length})`,
            content: <PropertiesSection deal={data} propertyOptions={properties} preselectId={addProperty} locked={locked} />,
          },
          {
            id: "parties",
            label: `Parties (${data.parties.length})`,
            content: (
              <PartiesSection
                deal={data}
                companies={companyOpts}
                contacts={contacts}
                locked={locked}
              />
            ),
          },
          {
            id: "team",
            label: `Team (${data.team.length})`,
            content: <TeamSection deal={data} locked={locked} />,
          },
        ]}
      />
    </RecordFormProvider>
  );
}
