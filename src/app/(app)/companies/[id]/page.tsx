import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { requireUser } from "@/auth";
import { CommandBar, CommandDivider, CommandLink, RefreshCommand } from "@/components/command-bar";
import { FlagMark } from "@/components/data-grid";
import { Section } from "@/components/fields";
import {
  HousekeepingCommands,
  MainForm,
  ModifiedStamp,
  RecordFormProvider,
  RecordHeader,
  SaveCommand,
  Tabs,
} from "@/components/record-page";
import { partyLabel } from "@/domain/options";
import { companyDeals, getCompany } from "@/server/companies";
import { listContacts } from "@/server/contacts";
import { userName } from "@/server/people";
import { saveCompany } from "../actions";
import { CompanyFields } from "../company-fields";

export default async function CompanyPage({ params }: PageProps<"/companies/[id]">) {
  const { id } = await params;
  const [user, company, people, partyOn] = await Promise.all([
    requireUser(),
    getCompany(id),
    listContacts({ companyId: id }),
    companyDeals(id),
  ]);
  if (!company) notFound();
  const modifiedBy = await userName(company.lastModifiedById);

  return (
    <RecordFormProvider action={saveCompany.bind(null, id)}>
      <CommandBar>
        <SaveCommand />
        <CommandLink href={`/contacts/new?company=${id}`} icon={Plus}>
          New contact
        </CommandLink>
        <RefreshCommand />
        <CommandDivider />
        <HousekeepingCommands kind="company" id={id} archivedAt={company.archivedAt} canDelete={user.isAdmin && !company.systemKey} />
      </CommandBar>
      <RecordHeader
        kindLabel="Company"
        title={company.name}
        subtitle={company.types.join(", ") || undefined}
        facts={[
          { label: "Website", value: company.websiteDomain },
          { label: "Contacts", value: String(people.length) },
          { label: "Deals", value: String(partyOn.length) },
        ]}
        flags={
          <>
            {company.noWebsite && <FlagMark label="No website — flagged for cleanup" />}
            {company.archivedAt && <FlagMark label="Archived" />}
          </>
        }
      />
      <Tabs
        tabs={[
          {
            id: "summary",
            label: "Summary",
            content: (
              <>
                <Section title="Company">
                  <MainForm>
                    <CompanyFields company={company} />
                  </MainForm>
                </Section>
                <ModifiedStamp at={company.lastModifiedAt} by={modifiedBy} />
              </>
            ),
          },
          {
            id: "contacts",
            label: `Contacts (${people.length})`,
            content: (
              <Section title="Contacts">
                {people.length === 0 ? (
                  <p className="text-sm text-muted">No contacts yet.</p>
                ) : (
                  <ul className="divide-y divide-border text-sm">
                    {people.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                        <Link href={`/contacts/${p.id}`} className="font-semibold text-link hover:underline">
                          {p.firstName} {p.lastName}
                        </Link>
                        <span className="text-muted">{[p.title, p.email].filter(Boolean).join(" · ")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            ),
          },
          {
            id: "deals",
            label: `Deals (${partyOn.length})`,
            content: (
              <Section title="Deals">
                {partyOn.length === 0 ? (
                  <p className="text-sm text-muted">Not a party to any deal yet.</p>
                ) : (
                  <ul className="divide-y divide-border text-sm">
                    {partyOn.map((d) => (
                      <li key={`${d.id}-${d.side}`} className="flex justify-between gap-2 py-2">
                        <Link href={`/deals/${d.id}`} className="font-semibold text-link hover:underline">
                          {d.dealName}
                        </Link>
                        <span className="text-muted">{partyLabel(d.dealType, d.side)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            ),
          },
        ]}
      />
    </RecordFormProvider>
  );
}
