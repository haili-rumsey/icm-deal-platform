import { X } from "lucide-react";
import { CommandBar, CommandLink } from "@/components/command-bar";
import { Section } from "@/components/fields";
import { MainForm, RecordFormProvider, RecordHeader, SaveCommand } from "@/components/record-page";
import { streamPeopleOptions } from "@/server/contacts";
import { saveDeal } from "../actions";
import { DealFields } from "../deal-fields";

export default async function NewDealPage() {
  const streamPeople = await streamPeopleOptions();
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
        subtitle="Only the name is needed to start — properties, parties and the team are added after saving."
      />
      <div className="p-3 sm:p-5">
        <Section title="Summary">
          <MainForm>
            <DealFields streamPeople={streamPeople} />
          </MainForm>
        </Section>
      </div>
    </RecordFormProvider>
  );
}
