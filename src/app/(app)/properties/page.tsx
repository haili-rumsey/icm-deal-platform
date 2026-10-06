import { Plus } from "lucide-react";
import { CommandBar, CommandLink, RefreshCommand } from "@/components/command-bar";
import { DataGrid } from "@/components/data-grid";
import { searchParam } from "@/lib/params";
import { myListLayout } from "@/server/list-layouts";
import { listProperties } from "@/server/properties";

export default async function PropertiesPage({ searchParams }: PageProps<"/properties">) {
  const archived = searchParam((await searchParams).archived) === "1";
  const [rows, saved] = await Promise.all([listProperties({ archived }), myListLayout("properties")]);

  return (
    <>
      <CommandBar>
        <CommandLink href="/properties/new" icon={Plus}>
          New
        </CommandLink>
        <RefreshCommand />
      </CommandBar>
      <DataGrid
        listKey="properties"
        savedColumns={saved}
        views={[
          { label: "Active properties", href: "/properties", active: !archived },
          { label: "Archived properties", href: "/properties?archived=1", active: archived },
        ]}
        columns={[
          { key: "address", label: "Address", kind: "link", hrefKey: "href", flagKey: "unverified", flagLabel: "No Google match" },
          { key: "building", label: "Building" },
          { key: "name", label: "Name" },
          { key: "city", label: "City" },
          { key: "state", label: "State" },
          { key: "submarket", label: "Submarket" },
          { key: "sf", label: "SF", kind: "number" },
          { key: "deals", label: "Deals", kind: "number" },
          { key: "owners", label: "Current owner", defaultHidden: true },
          { key: "acreage", label: "Acres", kind: "number", defaultHidden: true },
          { key: "zip", label: "Zip", defaultHidden: true },
          { key: "county", label: "County", defaultHidden: true },
          { key: "buildingClass", label: "Class", defaultHidden: true },
          { key: "yearBuilt", label: "Year built", kind: "number", defaultHidden: true },
          { key: "clearHeight", label: "Clear height (ft)", kind: "number", defaultHidden: true },
          { key: "configuration", label: "Configuration", defaultHidden: true },
          { key: "tenancy", label: "Tenancy", defaultHidden: true },
        ]}
        rows={rows.map((p) => ({
          id: p.id,
          href: `/properties/${p.id}`,
          address: p.address ?? "(no address)",
          building: p.buildingDesignation,
          name: p.name,
          city: p.city,
          state: p.state,
          submarket: p.submarket,
          sf: p.buildingSf,
          deals: p.dealCount,
          unverified: !p.addressVerified,
          owners: p.owners,
          acreage: p.acreage === null ? null : Number(p.acreage),
          zip: p.zip,
          county: p.county,
          buildingClass: p.buildingClass,
          yearBuilt: p.yearBuilt,
          clearHeight: p.clearHeightFt === null ? null : Number(p.clearHeightFt),
          configuration: p.configuration,
          tenancy: p.tenancy,
        }))}
      />
    </>
  );
}
