import { Grid, Select, TextArea, TextInput } from "@/components/fields";
import { SearchSelect, type Option } from "@/components/search-select";
import { PITCH_STATUSES } from "@/domain/options";
import type { Deal } from "@/server/deals";
import { StageSelect } from "./stage-select";

/** Stage plus every key date. Dates overwrite; there's no date history. */
export function DealDatesFields({ deal, companies }: { deal?: Deal; companies: Option[] }) {
  const d = deal;
  return (
    <Grid>
      <StageSelect
        defaultValue={d?.stage ?? "BOV 1"}
        hint={
          d
            ? undefined
            : "A deal can start at any stage except Closed. For an IOS deal, save it at Under Contract, add the property and buyer, then move it to Closed."
        }
      />
      <TextInput label="Pitch date" name="pitchDate" type="date" defaultValue={d?.pitchDate} hint="Proposal delivered (→ BOV 2)." />
      <Select label="Pitch status" name="pitchStatus" options={PITCH_STATUSES} defaultValue={d?.pitchStatus} />
      <SearchSelect
        label="Lost to"
        name="lostToCompanyId"
        options={companies}
        defaultId={d?.lostToCompanyId}
        placeholder="Competitor who won it…"
      />
      <TextInput label="Won date" name="wonDate" type="date" defaultValue={d?.wonDate} hint="Client confirmed (→ Engaged)." />
      <TextInput label="Launch date" name="launchDate" type="date" defaultValue={d?.launchDate} hint="First marketing email (→ Marketing)." />
      <TextInput label="Call for offers" name="callForOffersDate" type="date" defaultValue={d?.callForOffersDate} />
      <TextInput label="Awarded date" name="awardedDate" type="date" defaultValue={d?.awardedDate} hint="Buyer selected (→ Awarded)." />
      <TextInput label="DD expiration" name="ddExpirationDate" type="date" defaultValue={d?.ddExpirationDate} />
      <TextInput label="Close date" name="closeDate" type="date" defaultValue={d?.closeDate} />
      <div className="xl:col-span-2">
        <TextArea label="Lost note" name="lostNote" defaultValue={d?.lostNote} />
      </div>
    </Grid>
  );
}
