import { Section } from "@/components/fields";
import { RecordForm } from "@/components/record-form";
import { streamPeopleOptions } from "@/server/contacts";
import { saveDeal } from "../actions";
import { DealFields } from "../deal-fields";

export default async function NewDealPage() {
  const streamPeople = await streamPeopleOptions();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">New deal</h1>
      <p className="text-sm text-muted">
        Only the name is needed to start. Properties, parties and the team are added on the next screen.
      </p>
      <Section title="Deal">
        <RecordForm action={saveDeal.bind(null, null)} submitLabel="Create deal">
          <DealFields streamPeople={streamPeople} />
        </RecordForm>
      </Section>
    </div>
  );
}
