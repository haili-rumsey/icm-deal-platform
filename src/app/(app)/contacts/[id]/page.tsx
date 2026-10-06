import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/auth";
import { CommandBar, CommandDivider, RefreshCommand } from "@/components/command-bar";
import { FlagMark } from "@/components/data-grid";
import { Section } from "@/components/fields";
import {
  HousekeepingCommands,
  MainForm,
  ModifiedStamp,
  RecordFormProvider,
  RecordHeader,
  BackCommand,
  SaveCommand,
} from "@/components/record-page";
import { companyOptions } from "@/server/companies";
import { getContact } from "@/server/contacts";
import { userName } from "@/server/people";
import { saveContact } from "../actions";
import { ContactFields } from "../contact-fields";

export default async function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  const { id } = await params;
  const [user, row, companies] = await Promise.all([requireUser(), getContact(id), companyOptions()]);
  if (!row) notFound();
  const { contact, companyName } = row;
  const modifiedBy = await userName(contact.lastModifiedById);

  return (
    <RecordFormProvider action={saveContact.bind(null, id)}>
      <CommandBar>
        <BackCommand fallbackHref="/contacts" />
        <SaveCommand />
        <RefreshCommand />
        <CommandDivider />
        <HousekeepingCommands kind="contact" id={id} archivedAt={contact.archivedAt} canDelete={user.isAdmin} />
      </CommandBar>
      <RecordHeader
        kindLabel="Contact"
        title={`${contact.firstName} ${contact.lastName}`.trim()}
        subtitle={
          <Link href={`/companies/${contact.companyId}`} className="text-link hover:underline">
            {companyName}
          </Link>
        }
        facts={[
          { label: "Title", value: contact.title },
          { label: "Email", value: contact.email },
          { label: "Phone", value: contact.phone },
        ]}
        flags={
          <>
            {contact.noEmail && <FlagMark label="No email — flagged for cleanup" />}
            {contact.archivedAt && <FlagMark label="Archived" />}
          </>
        }
      />
      <div className="flex flex-col gap-4 p-3 sm:p-5">
        <Section title="Summary">
          <MainForm>
            <ContactFields contact={contact} companies={companies.map((c) => ({ id: c.id, name: c.name, hint: c.domain }))} />
          </MainForm>
        </Section>
        <ModifiedStamp at={contact.lastModifiedAt} by={modifiedBy} />
      </div>
    </RecordFormProvider>
  );
}
