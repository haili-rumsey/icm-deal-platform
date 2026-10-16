"use client";

import { FieldRow, inputCls } from "@/components/fields";
import { STAGES } from "@/domain/options";

/** Stage field on the deal form. Tells the fee section when the stage changes; "Closed" opens the close pop-up (`canClose`). */
export function StageSelect({ defaultValue, hint, canClose = false }: { defaultValue: string; hint?: string; canClose?: boolean }) {
  return (
    <FieldRow label="Stage" htmlFor="stage" hint={hint}>
      <select
        id="stage"
        name="stage"
        defaultValue={defaultValue}
        onChange={(e) => {
          // Closing has one way in: the close pop-up (Haili, 1.6). On a saved deal, picking
          // Closed here opens it, and the field goes back to the current stage.
          if (e.target.value === "Closed" && canClose && defaultValue !== "Closed") {
            e.target.value = defaultValue;
            window.dispatchEvent(new CustomEvent("deal-close-request"));
            return;
          }
          window.dispatchEvent(new CustomEvent("deal-stage-change", { detail: e.target.value }));
        }}
        className={inputCls}
      >
        {STAGES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
    </FieldRow>
  );
}
