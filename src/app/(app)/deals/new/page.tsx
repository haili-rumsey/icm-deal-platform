import { X } from "lucide-react";
import { CommandBar, CommandLink } from "@/components/command-bar";
import { Section } from "@/components/fields";
import { MainForm, RecordFormProvider, RecordHeader, BackCommand, SaveCommand } from "@/components/record-page";
import { companyOptions } from "@/server/companies";
import { icmTeamOptions, streamPeopleOptions } from "@/server/contacts";
import { saveDeal } from "../actions";
import { DealDatesFields } from "../deal-dates-fields";
import { DealFields } from "../deal-fields";
import { DealFeeFields, DealMoneyFields } from "../deal-money-fields";
import { FeeVisibility } from "../fee-visibility";
import { DealTeamFields } from "../deal-team-fields";

export default async function NewDealPage() {
  const [streamPeople, icmTeam, companies] = await Promise.all([streamPeopleOptions(), icmTeamOptions(), companyOptions()]);
  return (
    <RecordFormProvider action={saveDeal.bind(null, null)}>
      <CommandBar>
        <BackCommand fallbackHref="/deals" />
        <SaveCommand />
        <CommandLink href="/deals" icon={X}>
          Cancel
        </CommandLink>
      </CommandBar>
      <RecordHeader
        kindLabel="Deal"
        title="New deal"
        subtitle="Only the name is needed to start — properties and parties are added after saving."
      />
      <div className="p-3 sm:p-5">
        <MainForm>
          <Section title="Deal">
            <DealFields />
          </Section>
          <Section title="Stage and dates">
            <DealDatesFields companies={companies.map((c) => ({ id: c.id, name: c.name, hint: c.domain }))} />
          </Section>
          <Section title="Team">
            <DealTeamFields
              icmTeam={icmTeam}
              streamPeople={streamPeople}
              initial={{ teamIds: [], leadBrokerIds: [], leadAnalystId: null, referralId: null }}
            />
          </Section>
          <Section title="Pricing and underwriting">
            <DealMoneyFields />
          </Section>
          <FeeVisibility initialStage="BOV 1" hasFeeData={false}>
            <Section title="Fee">
              <DealFeeFields />
            </Section>
          </FeeVisibility>
        </MainForm>
      </div>
    </RecordFormProvider>
  );
}
