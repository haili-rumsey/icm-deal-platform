import { Plus } from "lucide-react";
import { CommandBar, CommandLink, RefreshCommand } from "@/components/command-bar";
import { DataGrid } from "@/components/data-grid";
import { searchParam } from "@/lib/params";
import { listCompanies } from "@/server/companies";

export default async function CompaniesPage({ searchParams }: PageProps<"/companies">) {
  const archived = searchParam((await searchParams).archived) === "1";
  const rows = await listCompanies({ archived });

  return (
    <>
      <CommandBar>
        <CommandLink href="/companies/new" icon={Plus}>
          New
        </CommandLink>
        <RefreshCommand />
      </CommandBar>
      <DataGrid
        views={[
          { label: "Active companies", href: "/companies", active: !archived },
          { label: "Archived companies", href: "/companies?archived=1", active: archived },
        ]}
        columns={[
          { key: "name", label: "Name", kind: "link", hrefKey: "href" },
          { key: "website", label: "Website", flagKey: "noWebsite", flagLabel: "No website" },
          { key: "types", label: "Type" },
          { key: "contacts", label: "Contacts", kind: "number" },
        ]}
        rows={rows.map((c) => ({
          id: c.id,
          href: `/companies/${c.id}`,
          name: c.name,
          website: c.websiteDomain,
          noWebsite: c.noWebsite,
          types: c.types.join(", "),
          contacts: c.contactCount,
        }))}
      />
    </>
  );
}
