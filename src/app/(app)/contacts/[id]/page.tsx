import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/auth";
import { Section } from "@/components/fields";
import { RecordFooter } from "@/components/record-footer";
import { RecordForm } from "@/components/record-form";
import { companyOptions } from "@/server/companies";
import { getContact } from "@/server/contacts";
import { userName } from "@/server/people";
import { saveContact } from "../actions";
import { ContactFields } from "../contact-fields";

export default async function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const row = await getContact(id);
  if (!row) notFound();
  const { contact, companyName } = row;
  const [companies, modifiedBy] = await Promise.all([companyOptions(), userName(contact.lastModifiedById)]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-muted">
          <Link href="/contacts" className="hover:underline">
            Contacts
          </Link>
        </p>
        <h1 className="text-xl font-semibold">
          {contact.firstName} {contact.lastName}
        </h1>
        <p className="text-sm text-muted">
          <Link href={`/companies/${contact.companyId}`} className="hover:underline">
            {companyName}
          </Link>
          {contact.title && ` · ${contact.title}`}
        </p>
        {contact.noEmail && <p className="mt-1 text-xs text-danger">No email — flagged for cleanup</p>}
      </div>

      <Section title="Contact">
        <RecordForm action={saveContact.bind(null, id)}>
          <ContactFields contact={contact} companies={companies.map((c) => ({ id: c.id, name: c.name, hint: c.domain }))} />
        </RecordForm>
      </Section>

      <RecordFooter
        kind="contact"
        id={id}
        lastModifiedAt={contact.lastModifiedAt}
        lastModifiedBy={modifiedBy}
        archivedAt={contact.archivedAt}
        canDelete={user.isAdmin}
      />
    </div>
  );
}
