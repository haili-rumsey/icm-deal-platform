import { X } from "lucide-react";
import { CommandBar, CommandLink } from "@/components/command-bar";
import { Section } from "@/components/fields";
import { MainForm, RecordFormProvider, RecordHeader, BackCommand, SaveCommand } from "@/components/record-page";
import { saveCompany } from "../actions";
import { CompanyFields } from "../company-fields";

export default function NewCompanyPage() {
  return (
    <RecordFormProvider action={saveCompany.bind(null, null)}>
      <CommandBar>
        <BackCommand fallbackHref="/companies" />
        <SaveCommand />
        <CommandLink href="/companies" icon={X}>
          Cancel
        </CommandLink>
      </CommandBar>
      <RecordHeader kindLabel="Company" title="New company" />
      <div className="p-3 sm:p-5">
        <Section title="Summary">
          <MainForm>
            <CompanyFields />
          </MainForm>
        </Section>
      </div>
    </RecordFormProvider>
  );
}
