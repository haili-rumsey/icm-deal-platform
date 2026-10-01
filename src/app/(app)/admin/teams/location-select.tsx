"use client";

import { useTransition } from "react";
import { inputCls } from "@/components/fields";
import { LOCATIONS } from "@/domain/options";
import { setLocationAction } from "./actions";

/** Changing the office saves straight away. */
export function LocationSelect({ contactId, value }: { contactId: string; value: string | null }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Location"
      defaultValue={value ?? ""}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        start(() => setLocationAction(contactId, v));
      }}
      className={`${inputCls} w-32 py-1`}
    >
      <option value="">—</option>
      {LOCATIONS.map((l) => (
        <option key={l}>{l}</option>
      ))}
    </select>
  );
}
