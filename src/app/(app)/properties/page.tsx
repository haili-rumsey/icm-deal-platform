import { Plus } from "lucide-react";
import { CommandBar, CommandLink, RefreshCommand } from "@/components/command-bar";
import { DataGrid } from "@/components/data-grid";
import { searchParam } from "@/lib/params";
import { listProperties } from "@/server/properties";

export default async function PropertiesPage({ searchParams }: PageProps<"/properties">) {
  const archived = searchParam((await searchParams).archived) === "1";
  const rows = await listProperties({ archived });

  return (
    <>
      <CommandBar>
        <CommandLink href="/properties/new" icon={Plus}>
          New
        </CommandLink>
        <RefreshCommand />
      </CommandBar>
      <DataGrid
        views={[
          { label: "Active properties", href: "/properties", active: !archived },
          { label: "Archived properties", href: "/properties?archived=1", active: archived },
        ]}
        columns={[
          { key: "address", label: "Address", kind: "link", hrefKey: "href", flagKey: "unverified", flagLabel: "No Google match" },
          { key: "building", label: "Building" },
          { key: "city", label: "City" },
          { key: "state", label: "State" },
          { key: "submarket", label: "Submarket" },
          { key: "sf", label: "SF", kind: "number" },
          { key: "deals", label: "Deals", kind: "number" },
        ]}
        rows={rows.map((p) => ({
          id: p.id,
          href: `/properties/${p.id}`,
          address: p.address ?? "(no address)",
          building: p.buildingDesignation,
          city: p.city,
          state: p.state,
          submarket: p.submarket,
          sf: p.buildingSf,
          deals: p.dealCount,
          unverified: !p.addressVerified,
        }))}
      />
    </>
  );
}
