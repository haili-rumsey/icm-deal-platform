import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/auth";
import { Section } from "@/components/fields";
import { RecordFooter } from "@/components/record-footer";
import { RecordForm } from "@/components/record-form";
import { partyLabel } from "@/domain/options";
import { companyDeals, getCompany } from "@/server/companies";
import { listContacts } from "@/server/contacts";
import { userName } from "@/server/people";
import { saveCompany } from "../actions";
import { CompanyFields } from "../company-fields";

export default async function CompanyPage({ params }: PageProps<"/companies/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const company = await getCompany(id);
  if (!company) notFound();

  const [people, partyOn, modifiedBy] = await Promise.all([
    listContacts({ companyId: id }),
    companyDeals(id),
    userName(company.lastModifiedById),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-muted">
          <Link href="/companies" className="hover:underline">
            Companies
          </Link>
        </p>
        <h1 className="text-xl font-semibold">{company.name}</h1>
        {company.noWebsite && <p className="mt-1 text-xs text-danger">No website — flagged for cleanup</p>}
      </div>

      <Section title="Company">
        <RecordForm action={saveCompany.bind(null, id)}>
          <CompanyFields company={company} />
        </RecordForm>
      </Section>

      <Section
        title={`Contacts (${people.length})`}
        action={
          <Link href={`/contacts/new?company=${id}`} className="text-sm text-accent hover:underline">
            Add contact
          </Link>
        }
      >
        {people.length === 0 ? (
          <p className="text-sm text-muted">No contacts yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {people.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <Link href={`/contacts/${p.id}`} className="font-medium hover:underline">
                  {p.firstName} {p.lastName}
                </Link>
                <span className="text-muted">{[p.title, p.email].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Deals">
        {partyOn.length === 0 ? (
          <p className="text-sm text-muted">Not a party to any deal yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {partyOn.map((d) => (
              <li key={`${d.id}-${d.side}`} className="flex justify-between gap-2 py-2">
                <Link href={`/deals/${d.id}`} className="font-medium hover:underline">
                  {d.dealName}
                </Link>
                <span className="text-muted">{partyLabel(d.dealType, d.side)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <RecordFooter
        kind="company"
        id={id}
        lastModifiedAt={company.lastModifiedAt}
        lastModifiedBy={modifiedBy}
        archivedAt={company.archivedAt}
        canDelete={user.isAdmin && !company.systemKey}
      />
    </div>
  );
}
