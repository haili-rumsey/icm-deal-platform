import { X } from "lucide-react";
import { CommandBar, CommandLink } from "@/components/command-bar";
import { Section } from "@/components/fields";
import { MainForm, RecordFormProvider, RecordHeader, SaveCommand } from "@/components/record-page";
import { icmTeamOptions, streamPeopleOptions } from "@/server/contacts";
import { saveDeal } from "../actions";
import { DealFields } from "../deal-fields";
import { DealTeamFields } from "../deal-team-fields";

export default async function NewDealPage() {
  const [streamPeople, icmTeam] = await Promise.all([streamPeopleOptions(), icmTeamOptions()]);
  return (
    <RecordFormProvider action={saveDeal.bind(null, null)}>
      <CommandBar>
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
          <Section title="Team">
            <DealTeamFields
              icmTeam={icmTeam}
              streamPeople={streamPeople}
              initial={{ teamIds: [], leadBrokerIds: [], leadAnalystId: null, referralId: null }}
            />
          </Section>
        </MainForm>
      </div>
    </RecordFormProvider>
  );
}
