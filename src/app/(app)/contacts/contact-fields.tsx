import { Grid, TextArea, TextInput } from "@/components/fields";
import { OverrideField } from "@/components/override-field";
import { SearchSelect, type Option } from "@/components/search-select";
import type { Contact } from "@/server/contacts";

export function ContactFields({
  contact,
  companies,
  defaultCompanyId,
}: {
  contact?: Contact;
  companies: Option[];
  defaultCompanyId?: string | null;
}) {
  return (
    <>
      <Grid>
        <TextInput label="First name" name="firstName" defaultValue={contact?.firstName} required />
        <TextInput label="Last name" name="lastName" defaultValue={contact?.lastName} />
        <SearchSelect
          label="Company"
          name="companyId"
          options={companies}
          defaultId={contact?.companyId ?? defaultCompanyId}
          placeholder="Search companies…"
        />
        <TextInput label="Title" name="title" defaultValue={contact?.title} />
        <OverrideField
          label="Email"
          name="email"
          type="email"
          overrideName="noEmail"
          overrideLabel="No email (flags for cleanup)"
          defaultValue={contact?.email}
          defaultOverride={contact?.noEmail}
        />
        <TextInput label="Phone" name="phone" type="tel" defaultValue={contact?.phone} />
      </Grid>
      <TextArea label="Notes" name="notes" defaultValue={contact?.notes} />
    </>
  );
}
