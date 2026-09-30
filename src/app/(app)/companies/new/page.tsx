import { Section } from "@/components/fields";
import { RecordForm } from "@/components/record-form";
import { saveCompany } from "../actions";
import { CompanyFields } from "../company-fields";

export default function NewCompanyPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">New company</h1>
      <Section title="Company">
        <RecordForm action={saveCompany.bind(null, null)} submitLabel="Create company">
          <CompanyFields />
        </RecordForm>
      </Section>
    </div>
  );
}
