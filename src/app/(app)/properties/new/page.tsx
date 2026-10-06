import { X } from "lucide-react";
import { CommandBar, CommandLink } from "@/components/command-bar";
import { Section } from "@/components/fields";
import { MainForm, RecordFormProvider, RecordHeader, BackCommand, SaveCommand } from "@/components/record-page";
import { searchParam } from "@/lib/params";
import { companyOptions } from "@/server/companies";
import { geoLookup } from "@/server/geography";
import { saveProperty } from "../actions";
import { PropertyFields } from "../property-fields";

export default async function NewPropertyPage({ searchParams }: PageProps<"/properties/new">) {
  const sp = await searchParams;
  const dealId = searchParam(sp.deal);
  const [companyRows, geo] = await Promise.all([companyOptions(), geoLookup()]);
  const companies = companyRows.map((c) => ({ id: c.id, name: c.name, hint: c.domain }));

  return (
    <RecordFormProvider action={saveProperty.bind(null, null)}>
      <CommandBar>
        <BackCommand fallbackHref="/properties" />
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
            <PropertyFields companies={companies} geo={geo} />
          </MainForm>
        </Section>
      </div>
    </RecordFormProvider>
  );
}
