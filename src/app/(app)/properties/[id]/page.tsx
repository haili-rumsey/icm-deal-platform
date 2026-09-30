import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/auth";
import { Section } from "@/components/fields";
import { RecordFooter } from "@/components/record-footer";
import { RecordForm } from "@/components/record-form";
import { companyOptions } from "@/server/companies";
import { userName } from "@/server/people";
import { getProperty, propertyLabel } from "@/server/properties";
import { saveProperty } from "../actions";
import { PropertyFields } from "../property-fields";

export default async function PropertyPage({ params }: PageProps<"/properties/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const data = await getProperty(id);
  if (!data) notFound();
  const { property, owners, deals } = data;
  const [companies, modifiedBy] = await Promise.all([companyOptions(), userName(property.lastModifiedById)]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-muted">
          <Link href="/properties" className="hover:underline">
            Properties
          </Link>
        </p>
        <h1 className="text-xl font-semibold">{propertyLabel(property)}</h1>
        {!property.addressVerified && (
          <p className="mt-1 text-xs text-danger">No Google match — flagged for cleanup</p>
        )}
      </div>

      <Section title="Property">
        <RecordForm action={saveProperty.bind(null, id)}>
          <PropertyFields
            property={property}
            companies={companies.map((c) => ({ id: c.id, name: c.name, hint: c.domain }))}
            ownerIds={owners.map((o) => o.id)}
          />
        </RecordForm>
      </Section>

      <Section title={`Deals (${deals.length})`}>
        {deals.length === 0 ? (
          <p className="text-sm text-muted">Not part of any deal yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {deals.map((d) => (
              <li key={d.id} className="flex justify-between gap-2 py-2">
                <Link href={`/deals/${d.id}`} className="font-medium hover:underline">
                  {d.dealName}
                </Link>
                <span className="text-muted">{d.dealType}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <RecordFooter
        kind="property"
        id={id}
        lastModifiedAt={property.lastModifiedAt}
        lastModifiedBy={modifiedBy}
        archivedAt={property.archivedAt}
        canDelete={user.isAdmin}
      />
    </div>
  );
}
