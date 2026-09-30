import { Section } from "@/components/fields";
import { searchParam } from "@/components/list-page";
import { RecordForm } from "@/components/record-form";
import { companyOptions } from "@/server/companies";
import { saveProperty } from "../actions";
import { PropertyFields } from "../property-fields";

export default async function NewPropertyPage({ searchParams }: PageProps<"/properties/new">) {
  const sp = await searchParams;
  const dealId = searchParam(sp.deal);
  const companies = (await companyOptions()).map((c) => ({ id: c.id, name: c.name, hint: c.domain }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">New property</h1>
      <Section title="Property">
        <RecordForm action={saveProperty.bind(null, null)} submitLabel={dealId ? "Create and add to deal" : "Create property"}>
          {dealId && <input type="hidden" name="returnToDeal" value={dealId} />}
          <PropertyFields companies={companies} />
        </RecordForm>
      </Section>
    </div>
  );
}
