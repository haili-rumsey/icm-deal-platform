"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { FieldRow, inputCls, MoneyInput, TextArea } from "@/components/fields";
import { MainForm, RecordFormProvider, SaveCommand, useUnsavedChanges } from "@/components/record-page";
import type { Option } from "@/components/search-select";
import { closeDealAction, moveStageAction, quickDealAction, quickSaveDealAction, type QuickDeal } from "@/app/(app)/deals/actions";
import { StageBar } from "@/app/(app)/deals/[id]/stage-bar";

/**
 * Quick edit (Haili, 1.6): a panel over the Pipeline report for the weekly meeting.
 * The deal's stage bar works exactly as on the deal page (date prompts, Lost/Dead
 * notes, the close pop-up); below it, the few fields discussed in the meeting.
 * Reloads whenever the deal changes on the server (`version`).
 */
export function QuickEditPanel({
  id,
  version,
  companies,
  onClose,
}: {
  id: string;
  /** The deal's last-modified time from the report row; a change reloads the panel. */
  version: string | null;
  companies: Option[];
  onClose: () => void;
}) {
  const [deal, setDeal] = useState<QuickDeal | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    quickDealAction(id)
      .then((d) => {
        if (cancelled) return;
        setDeal(d);
        setFailed(!d);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [id, version]);

  return (
    <aside
      aria-label="Quick edit"
      className="fixed inset-y-0 right-0 z-40 flex w-[min(40rem,100vw)] flex-col border-l border-border bg-card shadow-2xl"
    >
      {deal && deal.id === id ? (
        <RecordFormProvider key={deal.version} action={quickSaveDealAction.bind(null, id)}>
          <PanelBody deal={deal} companies={companies} onClose={onClose} />
        </RecordFormProvider>
      ) : (
        <>
          <PanelHeader title={failed ? "Deal not found" : "Loading…"} id={id} onClose={onClose} />
          {failed && <p className="p-5 text-sm text-muted">This deal couldn&apos;t be loaded. It may have been deleted.</p>}
        </>
      )}
    </aside>
  );
}

function PanelHeader({ title, id, onClose, dirty = false }: { title: string; id: string; onClose: () => void; dirty?: boolean }) {
  const [confirm, dialog] = useConfirm();
  async function close() {
    if (
      dirty &&
      !(await confirm({
        title: "Unsaved changes",
        message: "You've changed this deal without saving. Closing the panel will discard those changes. To keep them, cancel and click Save first.",
        confirmLabel: "Close without saving",
        cancelLabel: "Cancel",
      }))
    )
      return;
    onClose();
  }
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border bg-navy px-5 py-3 text-white">
      {dialog}
      <div className="min-w-0">
        <p className="text-xs text-white/70">Quick edit</p>
        <h2 className="truncate font-serif text-lg">{title}</h2>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Link href={`/deals/${id}`} title="Open the full deal" className="flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-white/10">
          <ExternalLink size={16} strokeWidth={1.75} />
          Open deal
        </Link>
        <button type="button" onClick={close} aria-label="Close quick edit" className="rounded p-1.5 hover:bg-white/10">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

function PanelBody({ deal, companies, onClose }: { deal: QuickDeal; companies: Option[]; onClose: () => void }) {
  const dirty = useUnsavedChanges();
  return (
    <>
      <PanelHeader title={deal.dealName} id={deal.id} onClose={onClose} dirty={dirty} />
      <div className="flex-1 overflow-y-auto">
        <StageBar
          stage={deal.stage}
          dates={deal.dates}
          companies={companies}
          locked={deal.locked}
          closeInfo={deal.closeInfo}
          action={moveStageAction.bind(null, deal.id)}
          closeAction={closeDealAction.bind(null, deal.id)}
        />
        {deal.locked && (
          <p className="border-b border-border bg-[#eef2f8] px-5 py-2 text-sm">
            This deal is closed, so it&apos;s read-only. Only Haili Rumsey, Seth Koschak and Matteson Hamilton can change it.
          </p>
        )}
        <div className="p-5">
          <MainForm readOnly={deal.locked}>
            {deal.keyDate && (
              <FieldRow label={deal.keyDate.label} htmlFor={deal.keyDate.field}>
                <input
                  id={deal.keyDate.field}
                  name={deal.keyDate.field}
                  type="date"
                  defaultValue={deal.keyDate.value ?? ""}
                  className={`${inputCls} w-48`}
                />
              </FieldRow>
            )}
            {deal.price && <MoneyInput label={deal.price.label} name={deal.price.field} defaultValue={deal.price.value} />}
            {deal.fee.show && <MoneyInput label="Fee (total commission)" name="totalCommission" defaultValue={deal.fee.value} />}
            <FieldRow label="Lead analyst" htmlFor="leadAnalystId">
              <select id="leadAnalystId" name="leadAnalystId" defaultValue={deal.leadAnalystId ?? ""} className={inputCls}>
                <option value="">—</option>
                {deal.team.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </FieldRow>
            <TextArea label="Deal notes" name="closingNotes" defaultValue={deal.notes} />
          </MainForm>
          {!deal.locked && (
            <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
              <SaveCommand />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
