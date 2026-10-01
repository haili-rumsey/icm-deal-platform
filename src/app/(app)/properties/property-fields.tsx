import { FieldRow, Grid, Select, TextInput } from "@/components/fields";
import { MultiSelect } from "@/components/multi-select";
import type { Option } from "@/components/search-select";
import { BUILDING_CLASSES, CONFIGURATIONS, SPRINKLER_TYPES, TENANCY } from "@/domain/options";
import type { Property } from "@/server/properties";
import { AddressLookup } from "./address-lookup";

export function PropertyFields({
  property,
  companies,
  ownerIds,
}: {
  property?: Property;
  companies: Option[];
  ownerIds?: string[];
}) {
  const p = property;
  return (
    <>
      <FieldRow label="Address">
        <AddressLookup
        initial={
          p
            ? {
                address: p.address ?? "",
                city: p.city ?? "",
                state: p.state ?? "",
                zip: p.zip ?? "",
                county: p.county ?? "",
                googlePlaceId: p.googlePlaceId ?? "",
                lat: p.lat ?? "",
                lng: p.lng ?? "",
                verified: p.addressVerified,
              }
            : undefined
        }
        />
      </FieldRow>
      <Grid>
        <TextInput
          label="Building designation"
          name="buildingDesignation"
          defaultValue={p?.buildingDesignation}
          placeholder="Building A, Bldg 2"
          hint="Tells apart buildings that share one address."
        />
        <TextInput label="Building SF" name="buildingSf" defaultValue={p?.buildingSf} />
        <TextInput label="Acreage" name="acreage" defaultValue={p?.acreage} />
        <TextInput label="Occupancy %" name="occupancyPct" defaultValue={p?.occupancyPct} />
        <Select label="Tenancy" name="tenancy" options={TENANCY} defaultValue={p?.tenancy} />
        <Select label="Class" name="buildingClass" options={BUILDING_CLASSES} defaultValue={p?.buildingClass} />
        <TextInput label="Year built" name="yearBuilt" defaultValue={p?.yearBuilt} />
        <TextInput label="Clear height (ft)" name="clearHeightFt" defaultValue={p?.clearHeightFt} />
        <Select label="Configuration" name="configuration" options={CONFIGURATIONS} defaultValue={p?.configuration} />
        <TextInput label="Dock doors" name="dockDoors" defaultValue={p?.dockDoors} />
        <TextInput label="Office finish SF" name="officeFinishSf" defaultValue={p?.officeFinishSf} />
        <Select label="Sprinkler" name="sprinklerType" options={SPRINKLER_TYPES} defaultValue={p?.sprinklerType} />
      </Grid>
      <MultiSelect name="ownerIds" label="Current owner(s)" options={companies} defaultIds={ownerIds} />
    </>
  );
}
