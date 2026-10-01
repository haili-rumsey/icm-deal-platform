"use client";

import { FieldRow, inputCls } from "@/components/fields";
import { STAGES } from "@/domain/options";

/** Stage field on the deal form. Tells the fee section when the stage changes. */
export function StageSelect({ defaultValue, hint }: { defaultValue: string; hint?: string }) {
  return (
    <FieldRow label="Stage" htmlFor="stage" hint={hint}>
      <select
        id="stage"
        name="stage"
        defaultValue={defaultValue}
        onChange={(e) => window.dispatchEvent(new CustomEvent("deal-stage-change", { detail: e.target.value }))}
        className={inputCls}
      >
        {STAGES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
    </FieldRow>
  );
}
