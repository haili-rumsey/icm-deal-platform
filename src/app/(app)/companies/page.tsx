import { Plus } from "lucide-react";
import { CommandLink, RefreshCommand } from "@/components/command-bar";
import { DataGrid } from "@/components/data-grid";
import { searchParam } from "@/lib/params";
import { listCompanies } from "@/server/companies";
import { myListLayout } from "@/server/list-layouts";

export default async function CompaniesPage({ searchParams }: PageProps<"/companies">) {
  const archived = searchParam((await searchParams).archived) === "1";
  const [rows, saved] = await Promise.all([listCompanies({ archived }), myListLayout("companies")]);

  return (
    <DataGrid
      commands={
        <>
          <CommandLink href="/companies/new" icon={Plus}>
            New
          </CommandLink>
          <RefreshCommand />
        </>
      }
      listKey="companies"
      savedColumns={saved}
      views={[
        { label: "Active companies", href: "/companies", active: !archived },
        { label: "Archived companies", href: "/companies?archived=1", active: archived },
      ]}
      columns={[
        { key: "name", label: "Name", kind: "link", hrefKey: "href" },
        { key: "website", label: "Website", flagKey: "noWebsite", flagLabel: "No website" },
        { key: "types", label: "Type", multi: true },
        { key: "contacts", label: "Contacts", kind: "number" },
        { key: "deals", label: "Deals", kind: "number", defaultHidden: true },
        { key: "strategies", label: "Investment strategy", multi: true, defaultHidden: true },
      ]}
      rows={rows.map((c) => ({
        id: c.id,
        href: `/companies/${c.id}`,
        name: c.name,
        website: c.websiteDomain,
        noWebsite: c.noWebsite,
        types: c.types.join(", "),
        contacts: c.contactCount,
        deals: c.dealCount,
        strategies: c.investmentStrategies.join(", "),
      }))}
    />
  );
}
