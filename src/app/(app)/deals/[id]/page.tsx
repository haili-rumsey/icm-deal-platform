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
  SaveCommand,
  Tabs,
} from "@/components/record-page";
import { partyLabel, type DealType } from "@/domain/options";
import { searchParam } from "@/lib/params";
import { companyOptions } from "@/server/companies";
import { contactOptions, icmTeamOptions, streamPeopleOptions } from "@/server/contacts";
import { getDeal } from "@/server/deals";
import { propertyOptions } from "@/server/properties";
import { saveDeal } from "../actions";
import { DealFields } from "../deal-fields";
import { DealTeamFields } from "../deal-team-fields";
import { PartiesSection, PropertiesSection, TeamSection } from "./sections";

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

  // Prompted, never enforced.
  const type = deal.dealType as DealType | null;
  const missing = [
    !deal.dealType && "deal type",
    !deal.category && "category",
    data.properties.length === 0 && "properties",
    !data.parties.some((p) => p.side === "A") && (type ? partyLabel(type, "A").toLowerCase() : "side A party"),
    !data.team.some((t) => t.isLeadBroker) && "lead broker",
    !data.team.some((t) => t.isLeadAnalyst) && "lead analyst",
  ].filter((m): m is string => !!m);

  const totalSf = data.properties.reduce((s, p) => s + (p.buildingSf ?? 0), 0);
  const names = (side: "A" | "B") =>
    [...new Set(data.parties.filter((p) => p.side === side).map((p) => p.companyName))].join(" / ");
  const addProperty = searchParam(sp.addProperty);

  return (
    <RecordFormProvider action={saveDeal.bind(null, id)}>
      <CommandBar>
        <SaveCommand />
        <RefreshCommand />
        <CommandDivider />
        <HousekeepingCommands kind="deal" id={id} archivedAt={deal.archivedAt} canDelete={user.isAdmin} />
      </CommandBar>
      <RecordHeader
        kindLabel="Deal"
        title={deal.dealName}
        subtitle={[deal.dealType, deal.dealSubtype, deal.category, deal.isIos && "IOS desk"].filter(Boolean).join(" · ") || undefined}
        facts={[
          { label: partyLabel(type, "A"), value: names("A") },
          { label: partyLabel(type, "B"), value: names("B") },
          { label: "Total SF", value: totalSf ? totalSf.toLocaleString("en-US") : null },
          { label: "Lead broker", value: data.team.filter((t) => t.isLeadBroker).map((t) => t.name).join(", ") },
          { label: "Lead analyst", value: data.team.find((t) => t.isLeadAnalyst)?.name },
        ]}
        flags={deal.archivedAt ? <FlagMark label="Archived" /> : undefined}
      />
      <Tabs
        initial={addProperty ? "properties" : undefined}
        tabs={[
          {
            id: "summary",
            label: "Summary",
            content: (
              <>
                <Incomplete missing={missing} />
                <MainForm>
                  <Section title="Deal">
                    <DealFields deal={deal} />
                  </Section>
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
            content: <PropertiesSection deal={data} propertyOptions={properties} preselectId={addProperty} />,
          },
          {
            id: "parties",
            label: `Parties (${data.parties.length})`,
            content: (
              <PartiesSection
                deal={data}
                companies={companies.map((c) => ({ id: c.id, name: c.name, hint: c.domain }))}
                contacts={contacts}
              />
            ),
          },
          {
            id: "team",
            label: `Team (${data.team.length})`,
            content: <TeamSection deal={data} />,
          },
        ]}
      />
    </RecordFormProvider>
  );
}
