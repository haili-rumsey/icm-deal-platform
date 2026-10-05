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
  SaveCommand,
  Tabs,
} from "@/components/record-page";
import { companyOptions } from "@/server/companies";
import { geoLookup, submarketName } from "@/server/geography";
import { userName } from "@/server/people";
import { addressLine, getProperty } from "@/server/properties";
import { saveProperty } from "../actions";
import { PropertyFields } from "../property-fields";

export default async function PropertyPage({ params }: PageProps<"/properties/[id]">) {
  const { id } = await params;
  const [user, data, companies] = await Promise.all([requireUser(), getProperty(id), companyOptions()]);
  if (!data) notFound();
  const { property: p, owners, deals } = data;
  const [geo, submarket] = await Promise.all([geoLookup(p.submarketId), submarketName(p.submarketId)]);
  const modifiedBy = await userName(p.lastModifiedById);
  const title = p.name ?? addressLine(p);

  return (
    <RecordFormProvider action={saveProperty.bind(null, id)}>
      <CommandBar>
        <SaveCommand />
        <RefreshCommand />
        <CommandDivider />
        <HousekeepingCommands kind="property" id={id} archivedAt={p.archivedAt} canDelete={user.isAdmin} />
      </CommandBar>
      <RecordHeader
        kindLabel="Property"
        title={title}
        subtitle={[p.name && addressLine(p), [p.city, p.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || undefined}
        facts={[
          { label: "Submarket", value: submarket?.name },
          { label: "Building SF", value: p.buildingSf?.toLocaleString("en-US") },
          { label: "Clear height", value: p.clearHeightFt ? `${Number(p.clearHeightFt)} ft` : null },
          { label: "Class", value: p.buildingClass },
          { label: "Current owner", value: owners.map((o) => o.name).join(" / ") },
        ]}
        flags={
          <>
            {!p.addressVerified && <FlagMark label="No Google match — flagged for cleanup" />}
            {p.archivedAt && <FlagMark label="Archived" />}
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
                <Section title="Property">
                  <MainForm>
                    <PropertyFields
                      property={p}
                      companies={companies.map((c) => ({ id: c.id, name: c.name, hint: c.domain }))}
                      ownerIds={owners.map((o) => o.id)}
                      geo={geo}
                    />
                  </MainForm>
                </Section>
                <ModifiedStamp at={p.lastModifiedAt} by={modifiedBy} />
              </>
            ),
          },
          {
            id: "deals",
            label: `Deals (${deals.length})`,
            content: (
              <Section title="Deal history">
                {deals.length === 0 ? (
                  <p className="text-sm text-muted">Not part of any deal yet.</p>
                ) : (
                  <ul className="divide-y divide-border text-sm">
                    {deals.map((d) => (
                      <li key={d.id} className="flex justify-between gap-2 py-2">
                        <Link href={`/deals/${d.id}`} className="font-semibold text-link hover:underline">
                          {d.dealName}
                        </Link>
                        <span className="text-muted">{d.dealType}</span>
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
