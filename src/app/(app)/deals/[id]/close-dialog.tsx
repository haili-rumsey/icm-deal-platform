"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FieldRow, formatAmount, inputCls } from "@/components/fields";
import { withCommas } from "@/components/number-input";
import { SearchSelect, type Option } from "@/components/search-select";
import {
  DEAL_TYPES,
  FEE_ONLY_TYPES,
  OPPORTUNITY_TYPES,
  partyLabel,
  REPRESENTED,
  SUBTYPES_BY_TYPE,
  type DealType,
} from "@/domain/options";
import type { CloseState } from "../actions";

/** What the pop-up needs to know about the deal (saved values). */
export type CloseInfo = {
  closeDate: string | null;
  dealType: DealType | null;
  dealSubtype: string | null;
  reappsId: string | null;
  opportunityType: string | null;
  represented: string | null;
  closedPrice: string | null;
  totalCapitalization: string | null;
  loanAmount: string | null;
  totalLeaseConsideration: string | null;
  totalCommission: string | null;
  outsideCommission: string | null;
  hasBuyer: boolean;
  /** Close requirements that live on the deal's tabs (properties, SF, team). */
  onTabs: string[];
};

const HEADLINE: Partial<Record<DealType, { name: keyof CloseInfo; label: string }>> = {
  Sale: { name: "closedPrice", label: "Sale price" },
  Equity: { name: "totalCapitalization", label: "Total capitalization" },
  Debt: { name: "loanAmount", label: "Loan amount" },
  Lease: { name: "totalLeaseConsideration", label: "Total lease consideration" },
};

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const n = (s: string) => (s.trim() === "" ? null : Number(s.replace(/[$,\s]/g, "")));

function Money({ name, value, set, hint, label }: { name: string; value: string; set: (v: string) => void; hint?: string; label: string }) {
  return (
    <FieldRow label={label} htmlFor={`close-${name}`} hint={hint}>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted">$</span>
        <input
          id={`close-${name}`}
          name={name}
          inputMode="decimal"
          value={value}
          onChange={(e) => set(e.target.value)}
          onBlur={(e) => set(withCommas(e.target.value))}
          className={`${inputCls} pl-6`}
        />
      </div>
    </FieldRow>
  );
}

function Pick({ name, label, options, value, set }: { name: string; label: string; options: readonly string[]; value: string; set: (v: string) => void }) {
  return (
    <FieldRow label={label} htmlFor={`close-${name}`}>
      <select id={`close-${name}`} name={name} value={value} onChange={(e) => set(e.target.value)} className={inputCls}>
        <option value="">—</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </FieldRow>
  );
}

/**
 * "Close this deal" (Haili, 1.6): everything needed to close, filled in in one place.
 * Fields already filled in on the deal are shown only where they're part of the close
 * (date, price, fee). Outside commission left blank counts as $0, and in-house gross is
 * total − outside. Properties, SF and the team live on the deal's tabs, so they're listed.
 */
export function CloseDialog({
  info,
  companies,
  action,
  onClose,
}: {
  info: CloseInfo;
  companies: Option[];
  action: (prev: CloseState, fd: FormData) => Promise<CloseState>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(action, null);
  // Which optional fields to ask for is decided once, from the saved deal.
  const [ask] = useState(() => ({
    reappsId: !info.reappsId,
    dealType: !info.dealType,
    dealSubtype: !info.dealSubtype,
    opportunityType: !info.opportunityType,
    represented: !info.represented,
    buyer: !info.hasBuyer,
  }));
  const [type, setType] = useState<string>(info.dealType ?? "");
  const [subtype, setSubtype] = useState(info.dealSubtype ?? "");
  const [opportunity, setOpportunity] = useState(info.opportunityType ?? "");
  const [represented, setRepresented] = useState(info.represented ?? "");
  const headline = HEADLINE[type as DealType] ?? (type ? null : HEADLINE.Sale!);
  const [price, setPrice] = useState(formatAmount(headline ? (info[headline.name] as string | null) : null));
  const [total, setTotal] = useState(formatAmount(info.totalCommission));
  const [outside, setOutside] = useState(formatAmount(info.outsideCommission));
  const t = n(total);
  const o = n(outside);
  const inHouse = t === null || Number.isNaN(t) ? "" : formatAmount(String(t - (o ?? 0)));
  const subtypes = type ? SUBTYPES_BY_TYPE[type as DealType] : [];
  const feeOnly = FEE_ONLY_TYPES.includes(type as DealType);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const missing = state?.missing ?? [];
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-md border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <form action={formAction} className="flex flex-col gap-4 p-6">
        <div>
          <h2 className="font-serif text-xl">Close this deal</h2>
          <p className="mt-1 text-sm text-muted">
            Fill these in to move the deal to Closed. Once closed, only Haili Rumsey, Seth Koschak and Matteson Hamilton can change it.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <FieldRow label="Close date" htmlFor="close-closeDate">
            <input id="close-closeDate" type="date" name="closeDate" defaultValue={info.closeDate ?? today()} className={`${inputCls} w-48`} />
          </FieldRow>
          {ask.dealType && <Pick name="dealType" label="Deal type" options={DEAL_TYPES} value={type} set={setType} />}
          {ask.dealSubtype && subtypes.length > 0 && <Pick name="dealSubtype" label="Subtype" options={subtypes} value={subtype} set={setSubtype} />}
          {ask.opportunityType && (
            <Pick name="opportunityType" label="Opportunity type" options={OPPORTUNITY_TYPES} value={opportunity} set={setOpportunity} />
          )}
          {ask.represented && <Pick name="represented" label="Side represented" options={REPRESENTED} value={represented} set={setRepresented} />}
          {ask.reappsId && (
            <FieldRow label="REApps ID" htmlFor="close-reappsId" hint="Assigned by accounting at closing.">
              <input id="close-reappsId" name="reappsId" className={inputCls} />
            </FieldRow>
          )}
          {ask.buyer && (
            <SearchSelect
              name="buyerCompanyId"
              label={partyLabel((type || null) as DealType | null, "B")}
              options={companies}
              placeholder="Search companies…"
            />
          )}
          {headline && !feeOnly && <Money name={headline.name} label={headline.label} value={price} set={setPrice} />}

          <div className="mt-1 border-b border-border pb-1">
            <h3 className="text-sm font-bold text-navy">Fee</h3>
          </div>
          <Money name="totalCommission" label="Total commission" value={total} set={setTotal} />
          <Money name="outsideCommission" label="Outside commission" value={outside} set={setOutside} hint="Paid outside ICM. Leave blank if none ($0)." />
          <FieldRow label="In-house gross" hint="Total − outside. Must add up to the total commission.">
            <p className="rounded-sm border border-border bg-background px-2.5 py-1.5 text-sm">{inHouse ? `$${inHouse}` : "—"}</p>
          </FieldRow>
        </div>

        {info.onTabs.length > 0 && (
          <div className="rounded-sm border border-border bg-background p-3 text-sm">
            <p className="font-semibold">Also needed, on the deal&apos;s tabs:</p>
            <ul className="mt-1 list-disc pl-5">
              {info.onTabs.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            <p className="mt-1 text-muted">Add these on the Properties or Team tab, then click Closed again. What you enter here is saved either way.</p>
          </div>
        )}

        {state?.message && (
          <div className="rounded-sm border border-danger/40 bg-[#fbeaea] p-3 text-sm">
            <p>{state.message}</p>
            {missing.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-sm border border-gray px-4 py-2 text-base font-semibold text-gray-dark hover:bg-hover">
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-sm bg-navy px-5 py-2 text-base font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Closing…" : "Close deal"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
