import { Plus } from "lucide-react";
import { CommandLink, RefreshCommand } from "@/components/command-bar";
import { searchParam } from "@/lib/params";
import { myListLayout } from "@/server/list-layouts";
import { listProperties } from "@/server/properties";
import { PropertiesGrid } from "./properties-grid";

export default async function PropertiesPage({ searchParams }: PageProps<"/properties">) {
  const archived = searchParam((await searchParams).archived) === "1";
  const [rows, saved] = await Promise.all([listProperties({ archived }), myListLayout("properties")]);

  return (
    <PropertiesGrid
      commands={
        <>
          <CommandLink href="/properties/new" icon={Plus}>
            New
          </CommandLink>
          <RefreshCommand />
        </>
      }
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
        // The Property report's search fields (PRD §6) show by default; filter any of them.
        { key: "buildingClass", label: "Class" },
        { key: "clearHeight", label: "Clear height (ft)", kind: "number" },
        { key: "configuration", label: "Configuration" },
        { key: "deals", label: "Deals", kind: "number" },
        { key: "owners", label: "Current owner", multi: true, defaultHidden: true },
        { key: "acreage", label: "Acres", kind: "number", defaultHidden: true },
        { key: "zip", label: "Zip", defaultHidden: true },
        { key: "county", label: "County", defaultHidden: true },
        { key: "yearBuilt", label: "Year built", kind: "number", defaultHidden: true },
        { key: "tenancy", label: "Tenancy", defaultHidden: true },
        { key: "occupancy", label: "Occupancy %", kind: "number", defaultHidden: true },
        { key: "dockDoors", label: "Dock doors", kind: "number", defaultHidden: true },
        { key: "officeFinishSf", label: "Office finish SF", kind: "number", defaultHidden: true },
        { key: "sprinkler", label: "Sprinkler", defaultHidden: true },
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
        occupancy: p.occupancyPct === null ? null : Number(p.occupancyPct),
        dockDoors: p.dockDoors,
        officeFinishSf: p.officeFinishSf,
        sprinkler: p.sprinklerType,
        // For the map view; not columns.
        lat: p.lat === null ? null : Number(p.lat),
        lng: p.lng === null ? null : Number(p.lng),
      }))}
    />
  );
}
