import { CheckboxGroup, Grid, TextArea, TextInput } from "@/components/fields";
import { OverrideField } from "@/components/override-field";
import { COMPANY_TYPES, INVESTMENT_STRATEGIES } from "@/domain/options";
import type { Company } from "@/server/companies";

export function CompanyFields({ company }: { company?: Company }) {
  return (
    <>
      <Grid>
        <TextInput
          label="Name"
          name="name"
          defaultValue={company?.name}
          required
          hint="The institutional owner's real name — never the LP or LLC holding the asset."
        />
        <OverrideField
          label="Website"
          name="website"
          overrideName="noWebsite"
          overrideLabel="No website (flags for cleanup)"
          placeholder="blackstone.com"
          defaultValue={company?.website}
          defaultOverride={company?.noWebsite}
        />
      </Grid>
      <CheckboxGroup label="Type" name="types" options={COMPANY_TYPES} defaultValues={company?.types} />
      <CheckboxGroup
        label="Investment strategy"
        name="investmentStrategies"
        options={INVESTMENT_STRATEGIES}
        defaultValues={company?.investmentStrategies}
      />
      <TextArea label="Notes" name="notes" defaultValue={company?.notes} />
    </>
  );
}
