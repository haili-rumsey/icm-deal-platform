import { X } from "lucide-react";
import { CommandBar, CommandLink } from "@/components/command-bar";
import { Section } from "@/components/fields";
import { MainForm, RecordFormProvider, RecordHeader, BackCommand, SaveCommand } from "@/components/record-page";
import { searchParam } from "@/lib/params";
import { companyOptions } from "@/server/companies";
import { saveContact } from "../actions";
import { ContactFields } from "../contact-fields";

export default async function NewContactPage({ searchParams }: PageProps<"/contacts/new">) {
  const sp = await searchParams;
  const companies = (await companyOptions()).map((c) => ({ id: c.id, name: c.name, hint: c.domain }));
  const companyId = searchParam(sp.company);

  return (
    <RecordFormProvider action={saveContact.bind(null, null)}>
      <CommandBar>
        <BackCommand fallbackHref="/contacts" />
        <SaveCommand />
        <CommandLink href={companyId ? `/companies/${companyId}` : "/contacts"} icon={X}>
          Cancel
        </CommandLink>
      </CommandBar>
      <RecordHeader kindLabel="Contact" title="New contact" />
      <div className="p-3 sm:p-5">
        <Section title="Summary">
          <MainForm>
            <ContactFields companies={companies} defaultCompanyId={companyId} />
          </MainForm>
        </Section>
      </div>
    </RecordFormProvider>
  );
}
