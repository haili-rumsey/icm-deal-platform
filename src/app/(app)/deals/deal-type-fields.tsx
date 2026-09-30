"use client";

import { useState } from "react";
import { Field } from "@/components/fields";
import { DEAL_TYPES, SUBTYPES_BY_TYPE, type DealType } from "@/domain/options";

const inputCls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

/** Subtype options depend on deal type; Lease has none. */
export function DealTypeFields({ dealType, dealSubtype }: { dealType?: string | null; dealSubtype?: string | null }) {
  const [type, setType] = useState<DealType | "">((dealType as DealType) ?? "");
  const subtypes = type ? SUBTYPES_BY_TYPE[type] : [];

  return (
    <>
      <Field label="Deal type">
        <select name="dealType" value={type} onChange={(e) => setType(e.target.value as DealType | "")} className={inputCls}>
          <option value="">—</option>
          {DEAL_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Subtype" hint={type === "Lease" ? "Not used for leases." : undefined}>
        <select
          key={type}
          name="dealSubtype"
          defaultValue={dealSubtype && (subtypes as readonly string[]).includes(dealSubtype) ? dealSubtype : ""}
          disabled={subtypes.length === 0}
          className={`${inputCls} disabled:opacity-50`}
        >
          <option value="">—</option>
          {subtypes.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
    </>
  );
}
