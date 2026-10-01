import { Checkbox, Grid, Select, TextArea, TextInput } from "@/components/fields";
import { CATEGORIES, OPPORTUNITY_TYPES, REPRESENTED } from "@/domain/options";
import type { Deal } from "@/server/deals";
import { DealTypeFields } from "./deal-type-fields";

export function DealFields({ deal }: { deal?: Deal }) {
  const d = deal;
  return (
    <>
      <Grid>
        <TextInput
          label="Deal name"
          name="dealName"
          defaultValue={d?.dealName}
          required
          placeholder="Client Name-Deal Name"
        />
        <TextInput label="REApps ID" name="reappsId" defaultValue={d?.reappsId} hint="Assigned by accounting at closing." />
        <DealTypeFields dealType={d?.dealType} dealSubtype={d?.dealSubtype} />
        <Select label="Category" name="category" options={CATEGORIES} defaultValue={d?.category} />
        <Select label="Opportunity type" name="opportunityType" options={OPPORTUNITY_TYPES} defaultValue={d?.opportunityType} />
        <Select label="Represented" name="represented" options={REPRESENTED} defaultValue={d?.represented} />
      </Grid>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Checkbox label="IOS desk deal" name="isIos" defaultChecked={d?.isIos} />
        <Checkbox label="Direct award (no competitive process)" name="directAward" defaultChecked={d?.directAward} />
      </div>
      <TextArea label="Closing notes" name="closingNotes" defaultValue={d?.closingNotes} />
    </>
  );
}
