"use client";

import { useState } from "react";
import { CheckboxDropdown, type PickOption } from "@/components/checkbox-dropdown";
import { FieldRow, Grid, inputCls } from "@/components/fields";

/**
 * Team and referral on the deal's Summary. Lead broker(s) and lead analyst are
 * chosen from whoever is ticked in "Deal team", updating as the team changes.
 */
export function DealTeamFields({
  icmTeam,
  streamPeople,
  initial,
}: {
  icmTeam: PickOption[];
  streamPeople: PickOption[];
  initial: { teamIds: string[]; leadBrokerIds: string[]; leadAnalystId: string | null; referralId: string | null };
}) {
  const [team, setTeam] = useState(initial.teamIds);
  const [brokers, setBrokers] = useState(initial.leadBrokerIds);
  const [analyst, setAnalyst] = useState(initial.leadAnalystId ?? "");
  const onTeam = icmTeam.filter((p) => team.includes(p.id));

  function changeTeam(ids: string[]) {
    setTeam(ids);
    // A lead who is taken off the team stops being a lead.
    setBrokers((b) => b.filter((id) => ids.includes(id)));
    if (analyst && !ids.includes(analyst)) setAnalyst("");
  }

  return (
    <Grid>
      <FieldRow label="Deal team" hint="Everyone who worked on the deal. Set roles on the Team tab.">
        <CheckboxDropdown
          name="teamIds"
          options={icmTeam}
          value={team}
          onChange={changeTeam}
          placeholder="Select ICM team members…"
          emptyText="No one on the ICM team roster yet."
        />
      </FieldRow>
      <FieldRow label="Referred by" htmlFor="referralContactId" hint="Anyone at Stream.">
        <select id="referralContactId" name="referralContactId" defaultValue={initial.referralId ?? ""} className={inputCls}>
          <option value="">—</option>
          {streamPeople.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </FieldRow>
      <FieldRow label="Lead broker(s)">
        <CheckboxDropdown
          name="leadBrokerIds"
          options={onTeam}
          value={brokers}
          onChange={setBrokers}
          placeholder={onTeam.length ? "Select from the deal team…" : "Add the deal team first"}
          emptyText="Add people to the deal team first."
        />
      </FieldRow>
      <FieldRow label="Lead analyst" htmlFor="leadAnalystId">
        <select
          id="leadAnalystId"
          name="leadAnalystId"
          value={analyst}
          onChange={(e) => setAnalyst(e.target.value)}
          disabled={onTeam.length === 0}
          className={inputCls}
        >
          <option value="">{onTeam.length ? "—" : "Add the deal team first"}</option>
          {onTeam.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </FieldRow>
    </Grid>
  );
}
