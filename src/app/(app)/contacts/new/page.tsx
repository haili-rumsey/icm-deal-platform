import { Section } from "@/components/fields";
import { RecordForm } from "@/components/record-form";
import { searchParam } from "@/components/list-page";
import { companyOptions } from "@/server/companies";
import { saveContact } from "../actions";
import { ContactFields } from "../contact-fields";

export default async function NewContactPage({ searchParams }: PageProps<"/contacts/new">) {
  const sp = await searchParams;
  const companies = (await companyOptions()).map((c) => ({ id: c.id, name: c.name, hint: c.domain }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">New contact</h1>
      <Section title="Contact">
        <RecordForm action={saveContact.bind(null, null)} submitLabel="Create contact">
          <ContactFields companies={companies} defaultCompanyId={searchParam(sp.company)} />
        </RecordForm>
      </Section>
    </div>
  );
}
