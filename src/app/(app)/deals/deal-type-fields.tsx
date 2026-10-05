"use client";

import { useState } from "react";
import { FieldRow, inputCls } from "@/components/fields";
import { DEAL_TYPES, SUBTYPES_BY_TYPE, type DealType } from "@/domain/options";

/** Subtype options depend on deal type; Lease, Consulting and Referral have none. */
export function DealTypeFields({ dealType, dealSubtype }: { dealType?: string | null; dealSubtype?: string | null }) {
  const [type, setType] = useState<DealType | "">((dealType as DealType) ?? "");
  const subtypes = type ? SUBTYPES_BY_TYPE[type] : [];

  return (
    <>
      <FieldRow label="Deal type" htmlFor="dealType">
        <select
          id="dealType"
          name="dealType"
          value={type}
          onChange={(e) => {
            const v = e.target.value as DealType | "";
            setType(v);
            // Lets the money section switch to this type's fields without a save.
            window.dispatchEvent(new CustomEvent("deal-type-change", { detail: v }));
          }}
          className={inputCls}
        >
          <option value="">—</option>
          {DEAL_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </FieldRow>
      <FieldRow label="Subtype" htmlFor="dealSubtype" hint={type && subtypes.length === 0 ? `Not used for ${type.toLowerCase()} deals.` : undefined}>
        <select
          key={type}
          id="dealSubtype"
          name="dealSubtype"
          defaultValue={dealSubtype && (subtypes as readonly string[]).includes(dealSubtype) ? dealSubtype : ""}
          disabled={subtypes.length === 0}
          className={inputCls}
        >
          <option value="">—</option>
          {subtypes.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </FieldRow>
    </>
  );
}
