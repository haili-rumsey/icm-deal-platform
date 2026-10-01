"use client";

import { useEffect, useState } from "react";
import { FieldRow, formatAmount, Grid, inputCls, MoneyInput, PctInput, TextArea, TextInput } from "@/components/fields";
import { withCommas } from "@/components/number-input";
import type { Deal } from "@/server/deals";

type Block = "bov" | "om" | "closed";

function Underwriting({ block, d }: { block: Block; d?: Deal }) {
  const v = (k: string) => (d ? ((d as Record<string, unknown>)[k] as string | null) : null);
  return (
    <>
      <PctInput label="Year 1 cap" name={`${block}Year1Cap`} defaultValue={v(`${block}Year1Cap`)} />
      <PctInput label="ULIRR" name={`${block}Ulirr`} defaultValue={v(`${block}Ulirr`)} />
      <PctInput label="LIRR" name={`${block}Lirr`} defaultValue={v(`${block}Lirr`)} />
      <PctInput label="Exit cap" name={`${block}ExitCap`} defaultValue={v(`${block}ExitCap`)} />
      <TextInput label="Hold period (yrs)" name={`${block}HoldYears`} defaultValue={v(`${block}HoldYears`)} />
    </>
  );
}

function BlockTitle({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="mt-2 border-b border-border pb-1 xl:col-span-2">
      <h3 className="text-sm font-bold text-navy">{children}</h3>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  );
}

/**
 * The three independent financial blocks plus each deal type's headline figure.
 * BOV doesn't apply to equity, debt or lease deals.
 */
export function DealMoneyFields({ deal }: { deal?: Deal }) {
  const d = deal;
  const [type, setType] = useState<string>(d?.dealType ?? "");
  useEffect(() => {
    const onChange = (e: Event) => setType((e as CustomEvent<string>).detail);
    window.addEventListener("deal-type-change", onChange);
    return () => window.removeEventListener("deal-type-change", onChange);
  }, []);
  const isSale = type === "" || type === "Sale";

  return (
    <Grid>
      {/* Fields that don't apply are hidden, not removed, so switching type never wipes them. */}
      <div className={type === "Equity" ? "contents" : "hidden"}>
        <MoneyInput label="Total capitalization" name="totalCapitalization" defaultValue={d?.totalCapitalization} />
      </div>
      <div className={type === "Debt" ? "contents" : "hidden"}>
          <MoneyInput label="Loan amount" name="loanAmount" defaultValue={d?.loanAmount} />
          <PctInput label="Interest rate" name="interestRate" defaultValue={d?.interestRate} />
          <TextInput label="Term (yrs)" name="loanTermYears" defaultValue={d?.loanTermYears} />
          <PctInput label="LTV" name="ltv" defaultValue={d?.ltv} />
      </div>
      <div className={type === "Lease" ? "contents" : "hidden"}>
        <MoneyInput label="Total lease consideration" name="totalLeaseConsideration" defaultValue={d?.totalLeaseConsideration} />
      </div>

      <div className={isSale ? "contents" : "hidden"}>
          <BlockTitle note="Overwritten in place if the deal is repriced.">BOV</BlockTitle>
          <MoneyInput label="Price — low" name="bovPriceLow" defaultValue={d?.bovPriceLow} />
          <MoneyInput label="Price — mid" name="bovPriceMid" defaultValue={d?.bovPriceMid} />
          <MoneyInput label="Price — high" name="bovPriceHigh" defaultValue={d?.bovPriceHigh} />
          <Underwriting block="bov" d={d} />
      </div>

      <BlockTitle note="Guidance is internal only — given out on request, never published.">OM / Guidance</BlockTitle>
      <MoneyInput label="Guidance price" name="guidancePrice" defaultValue={d?.guidancePrice} />
      <Underwriting block="om" d={d} />

      <BlockTitle>Closed</BlockTitle>
      <MoneyInput label="Sale price" name="closedPrice" defaultValue={d?.closedPrice} hint="One price from award through close. Note any retrade or credit in Price notes." />
      <Underwriting block="closed" d={d} />

      <div className="xl:col-span-2">
        <TextArea label="Price notes" name="priceNotes" defaultValue={d?.priceNotes} />
        <p className="mt-1 text-xs text-muted sm:ml-[10.25rem]">Retrades, credits, and anything else about how the price moved.</p>
      </div>
    </Grid>
  );
}

/** Fee — mirrors accounting. In-house gross fills itself as total − outside until typed over. */
export function DealFeeFields({ deal }: { deal?: Deal }) {
  const d = deal;
  const [total, setTotal] = useState(formatAmount(d?.totalCommission));
  const [outside, setOutside] = useState(formatAmount(d?.outsideCommission));
  const [manual, setManual] = useState(d?.inHouseGrossManual ?? false);
  const [typed, setTyped] = useState(formatAmount(d?.inHouseGross));
  const n = (s: string) => (s.trim() === "" ? null : Number(s.replace(/[$,\s]/g, "")));
  const t = n(total);
  const calculated = t === null || Number.isNaN(t) ? "" : formatAmount(String(t - (n(outside) ?? 0)));
  const money = (name: string, value: string, set: (v: string) => void) => (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted">$</span>
      <input
        id={name}
        name={name}
        inputMode="decimal"
        value={value}
        onChange={(e) => set(e.target.value)}
        onBlur={(e) => set(withCommas(e.target.value))}
        className={`${inputCls} pl-6`}
      />
    </div>
  );

  return (
    <Grid>
      <FieldRow label="Total commission" htmlFor="totalCommission">
        {money("totalCommission", total, setTotal)}
      </FieldRow>
      <FieldRow label="Outside commission" htmlFor="outsideCommission" hint="Paid outside ICM — co-brokers and other Stream entities.">
        {money("outsideCommission", outside, setOutside)}
      </FieldRow>
      <TextInput label="Outside commission to" name="outsideCommissionNote" defaultValue={d?.outsideCommissionNote} />
      <FieldRow
        label="In-house gross"
        htmlFor="inHouseGross"
        hint={manual ? "Typed figure (from accounting)." : "Calculated: total − outside. Type over it if accounting's figure differs."}
      >
        <input type="hidden" name="inHouseGrossManual" value={manual ? "true" : "false"} />
        {money("inHouseGross", manual ? typed : calculated, (v) => {
          setManual(true);
          setTyped(v);
        })}
        {manual && (
          <button type="button" onClick={() => setManual(false)} className="self-start text-xs text-link hover:underline">
            Use calculated figure
          </button>
        )}
      </FieldRow>
      <PctInput label="Fee %" name="feeRate" defaultValue={d?.feeRate} />
      <div className="xl:col-span-2">
        <TextArea label="Fee notes" name="feeNotes" defaultValue={d?.feeNotes} />
      </div>
    </Grid>
  );
}
