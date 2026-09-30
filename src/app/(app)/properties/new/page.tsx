import { X } from "lucide-react";
import { CommandBar, CommandLink } from "@/components/command-bar";
import { Section } from "@/components/fields";
import { MainForm, RecordFormProvider, RecordHeader, SaveCommand } from "@/components/record-page";
import { searchParam } from "@/lib/params";
import { companyOptions } from "@/server/companies";
import { saveProperty } from "../actions";
import { PropertyFields } from "../property-fields";

export default async function NewPropertyPage({ searchParams }: PageProps<"/properties/new">) {
  const sp = await searchParams;
  const dealId = searchParam(sp.deal);
  const companies = (await companyOptions()).map((c) => ({ id: c.id, name: c.name, hint: c.domain }));

  return (
    <RecordFormProvider action={saveProperty.bind(null, null)}>
      <CommandBar>
        <SaveCommand label={dealId ? "Save and add to deal" : "Save"} />
        <CommandLink href={dealId ? `/deals/${dealId}` : "/properties"} icon={X}>
          Cancel
        </CommandLink>
      </CommandBar>
      <RecordHeader kindLabel="Property" title="New property" />
      <div className="p-3 sm:p-5">
        <Section title="Summary">
          <MainForm>
            {dealId && <input type="hidden" name="returnToDeal" value={dealId} />}
            <PropertyFields companies={companies} />
          </MainForm>
        </Section>
      </div>
    </RecordFormProvider>
  );
}
