"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/confirm-dialog";
import { DataGrid, type Column, type Row } from "@/components/data-grid";
import { Checkbox, Grid, MoneyInput, NumberField, Section, Select, TextArea, TextInput } from "@/components/fields";
import { PendingButton } from "@/components/pending-button";
import { SearchSelect, type Option } from "@/components/search-select";
import { BID_ROUNDS } from "@/domain/options";
import { formatMoney, formatPsf, pricePerSf } from "@/domain/stages";
import type { ListLayout } from "@/server/list-layouts";
import type { BidRow } from "@/server/bids";
import { awardBidAction, deleteBidAction, saveBidAction, unawardBidAction, type BidFormState } from "../bid-actions";

const smallBtn = "rounded-sm border border-navy px-3 py-1.5 text-sm font-semibold text-navy hover:bg-hover disabled:opacity-50";
const quietBtn = "rounded-sm border border-gray px-3 py-1.5 text-sm text-gray-dark hover:bg-hover disabled:opacity-50";

const num = (v: string | null) => (v === null ? null : Number(v));
const day = (iso: string | null) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
};
const days = (n: number | null) => (n === null ? null : `${n} days`);

// Row colours, explained in the key above the matrix (Haili, 2026-11-10). Awarded wins over verbal.
const AWARDED_ROW = "bg-blue/20";
const VERBAL_ROW = "bg-gray-light";

const COLUMNS: Column[] = [
  { key: "bidder", label: "Bidder" },
  { key: "contact", label: "Contact" },
  { key: "round", label: "Round", sortKey: "roundOrder", type: "number" },
  { key: "amountLabel", label: "Offer", sortKey: "amount", type: "money" },
  { key: "psfLabel", label: "Price / SF", sortKey: "psf", type: "money" },
  { key: "offerType", label: "Verbal / LOI" },
  { key: "toured", label: "Toured" },
  { key: "initialEmLabel", label: "Initial EM", sortKey: "initialEm", type: "money" },
  { key: "additionalEmLabel", label: "Additional EM", sortKey: "additionalEm", type: "money", defaultHidden: true },
  { key: "ddLabel", label: "DD period", sortKey: "dd", type: "number" },
  { key: "closingLabel", label: "Closing period", sortKey: "closing", type: "number" },
  { key: "bidDateLabel", label: "Bid date", sortKey: "bidDate", type: "date" },
  { key: "notes", label: "Comments" },
  { key: "debtNotes", label: "Debt notes", defaultHidden: true },
];

/**
 * The deal's bids (milestone 2.1): the bid matrix — one row per bidder per round, sortable and
 * filterable like every list — plus the form to add or edit a bid and award it. Click a row
 * to edit that bid.
 */
export function BidsSection({
  dealId,
  bids,
  totalSf,
  companies,
  contacts,
  savedColumns,
  locked,
  round,
}: {
  dealId: string;
  /** The round picked in the matrix's dropdown ("all" or a round name), from the page address. */
  round?: string;
  bids: BidRow[];
  totalSf: number;
  companies: Option[];
  contacts: { id: string; name: string; companyId: string }[];
  savedColumns: ListLayout | null;
  locked?: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  // Bumped after each save so the "Add a bid" form starts empty again.
  const [formRound, setFormRound] = useState(0);
  const editing = bids.find((b) => b.id === editingId) ?? null;
  const closeForm = () => {
    setEditingId(null);
    setFormRound((n) => n + 1);
  };

  const rows: Row[] = bids.map((b) => {
    const amount = num(b.bidAmount);
    const psf = pricePerSf(amount, totalSf);
    return {
      id: b.id,
      bidder: b.companyName,
      contact: b.contactName,
      round: b.bidRound,
      roundOrder: b.bidRound ? BID_ROUNDS.indexOf(b.bidRound) + 1 : null,
      amount,
      amountLabel: formatMoney(amount),
      psf,
      psfLabel: formatPsf(psf),
      offerType: b.isVerbal ? "Verbal" : "LOI",
      toured: b.toured ? "Yes" : "No",
      initialEm: num(b.initialEm),
      initialEmLabel: formatMoney(num(b.initialEm)),
      additionalEm: num(b.additionalEm),
      additionalEmLabel: formatMoney(num(b.additionalEm)),
      dd: b.ddPeriodDays,
      ddLabel: days(b.ddPeriodDays),
      closing: b.closingPeriodDays,
      closingLabel: days(b.closingPeriodDays),
      bidDate: b.bidDate,
      bidDateLabel: day(b.bidDate),
      isAwarded: b.isAwarded,
      isVerbal: b.isVerbal,
      roundName: b.bidRound,
      notes: b.notes,
      debtNotes: b.debtNotes,
    };
  });

  // The title dropdown picks a round (Haili, 2026-11-10). It opens on the latest round that has
  // a bid; "All rounds" shows everything. A bid with no round set shows in every view, so a
  // missing round never hides a bid.
  const rounds = BID_ROUNDS.filter((r) => bids.some((b) => b.bidRound === r));
  const latest = rounds.at(-1) ?? null;
  const active = round === "all" ? "all" : rounds.find((r) => r === round) ?? latest ?? "all";
  const href = (r: string) => `/deals/${dealId}?tab=bids&round=${encodeURIComponent(r)}`;
  const views = [
    ...rounds.map((r) => ({ label: `Bid matrix — ${r}`, href: href(r), active: active === r })),
    { label: "Bid matrix — All rounds", href: href("all"), active: active === "all" },
  ];
  const shownRows = active === "all" ? rows : rows.filter((r) => r.roundName === active || r.roundName === null);

  return (
    <Section title={`Bids (${bids.length})`}>
      <div className="flex flex-col gap-4">
        {bids.length > 0 && (
          <>
            {/* Key for the row colours. */}
            <div className="flex flex-wrap items-center gap-5 text-sm">
              <span className="flex items-center gap-2">
                <span className={`inline-block h-4 w-6 rounded-sm border border-border ${AWARDED_ROW}`} /> Awarded bid
              </span>
              <span className="flex items-center gap-2">
                <span className={`inline-block h-4 w-6 rounded-sm border border-border ${VERBAL_ROW}`} /> Verbal offer
              </span>
            </div>
            <DataGrid
              key={active}
              embedded
              views={views}
              listKey="deal-bids"
              savedColumns={savedColumns}
              columns={COLUMNS}
              rows={shownRows}
              defaultSort={{ key: "amount", dir: "desc" }}
              onRowClick={locked ? undefined : (r) => setEditingId(String(r.id))}
              selectedId={editingId}
              rowClass={(r) => (r.isAwarded ? AWARDED_ROW : r.isVerbal ? VERBAL_ROW : undefined)}
              emptyText="No bids in this round."
            />
          </>
        )}
        {bids.length === 0 && <p className="text-sm text-muted">No bids yet.</p>}
        {!locked && (
          <BidForm
            key={editing?.id ?? `new-${formRound}`}
            dealId={dealId}
            bid={editing}
            defaultRound={active === "all" ? null : active}
            companies={companies}
            contacts={contacts}
            onDone={closeForm}
          />
        )}
      </div>
    </Section>
  );
}

function BidForm({
  dealId,
  bid,
  defaultRound,
  companies,
  contacts,
  onDone,
}: {
  dealId: string;
  bid: BidRow | null;
  /** A new bid starts in the round the matrix is showing. */
  defaultRound: string | null;
  companies: Option[];
  contacts: { id: string; name: string; companyId: string }[];
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<BidFormState, FormData>(saveBidAction.bind(null, dealId, bid?.id ?? null), {
    message: null,
  });
  const [companyId, setCompanyId] = useState<string | null>(bid?.companyId ?? null);
  const companyContacts = contacts.filter((c) => c.companyId === companyId);
  const [confirm, dialog] = useConfirm();
  const [busy, startBusy] = useTransition();
  const router = useRouter();
  // After a save the form closes (or, for a new bid, starts empty for the next one).
  useEffect(() => {
    if (state.saved) onDone();
  }, [state.saved, onDone]);

  async function award() {
    if (!bid) return;
    startBusy(async () => {
      const first = await awardBidAction(dealId, bid.id, "ask");
      if (!first.ok) {
        const replace = await confirm({
          title: "Replace the sale price?",
          message: `This deal's sale price is ${formatMoney(Number(first.confirmPrice.current))}. This bid is ${formatMoney(Number(first.confirmPrice.bid))}.`,
          confirmLabel: "Use the bid amount",
          cancelLabel: "Keep the current price",
        });
        await awardBidAction(dealId, bid.id, replace ? "replace" : "keep");
      }
      router.refresh();
    });
  }

  async function remove() {
    if (!bid) return;
    const ok = await confirm({
      title: "Delete this bid?",
      message: `${bid.companyName}${bid.bidRound ? ` · ${bid.bidRound}` : ""} will be removed from this deal for good.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    startBusy(async () => {
      await deleteBidAction(dealId, bid.id);
      onDone();
      router.refresh();
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-sm border border-dashed border-gray p-3">
      {dialog}
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">
          {bid ? `Edit bid — ${bid.companyName}${bid.isAwarded ? " (awarded)" : ""}` : "Add a bid"}
        </p>
        {bid && (
          <button type="button" onClick={onDone} className="text-sm text-muted hover:text-foreground">
            Close
          </button>
        )}
      </div>
      <Grid>
        <SearchSelect
          name="companyId"
          label="Bidder (company)"
          options={companies}
          defaultId={bid?.companyId}
          onChange={setCompanyId}
          placeholder="Search companies…"
        />
        <SearchSelect
          key={companyId ?? "none"}
          name="contactId"
          label="Contact"
          options={companyContacts}
          defaultId={bid && bid.companyId === companyId ? bid.contactId : null}
          placeholder={!companyId ? "Pick the company first" : companyContacts.length ? "Search this company's contacts…" : "No contacts at this company yet"}
        />
        <Select label="Round" name="bidRound" options={BID_ROUNDS} defaultValue={bid ? bid.bidRound : defaultRound} />
        <MoneyInput label="Offer" name="bidAmount" defaultValue={bid?.bidAmount} />
        <TextInput label="Bid date" name="bidDate" type="date" defaultValue={bid?.bidDate} />
        <div className="flex flex-wrap items-center gap-6 sm:ml-[10.25rem]">
          <Checkbox label="Verbal (unchecked = LOI)" name="isVerbal" defaultChecked={bid?.isVerbal} />
          <Checkbox label="Toured the project" name="toured" defaultChecked={bid?.toured} />
        </div>
        <MoneyInput label="Initial EM" name="initialEm" defaultValue={bid?.initialEm} />
        <MoneyInput label="Additional EM" name="additionalEm" defaultValue={bid?.additionalEm} />
        <NumberField label="DD period (days)" name="ddPeriodDays" defaultValue={bid?.ddPeriodDays} />
        <NumberField label="Closing period (days)" name="closingPeriodDays" defaultValue={bid?.closingPeriodDays} />
        <TextArea label="Comments" name="notes" defaultValue={bid?.notes} />
        <TextArea label="Debt notes" name="debtNotes" defaultValue={bid?.debtNotes} />
      </Grid>
      {state.message && <p className="text-sm text-danger">{state.message}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <PendingButton className={smallBtn} pendingLabel="Saving…">
          {bid ? "Save bid" : "Add bid"}
        </PendingButton>
        {bid && !bid.isAwarded && (
          <button type="button" disabled={busy} onClick={award} className={smallBtn}>
            Award this bid
          </button>
        )}
        {bid?.isAwarded && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              startBusy(async () => {
                await unawardBidAction(dealId, bid.id);
                router.refresh();
              })
            }
            className={quietBtn}
          >
            Remove award
          </button>
        )}
        {bid && (
          <button type="button" disabled={busy} onClick={remove} className="ml-auto text-sm text-muted hover:text-danger">
            Delete bid
          </button>
        )}
      </div>
      {bid && !bid.isAwarded && (
        <p className="text-xs text-muted">
          Awarding marks this bidder as the buyer: it&apos;s added to the buyer side, and the sale price fills from the offer if it&apos;s
          blank (you&apos;re asked before an existing price is replaced).
        </p>
      )}
    </form>
  );
}
