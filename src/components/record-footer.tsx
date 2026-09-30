"use client";

import { useActionState } from "react";
import { archiveAction, deleteAction, type DeleteState } from "@/app/(app)/housekeeping-actions";
import type { EntityKind } from "@/server/housekeeping";

function formatWhen(d: Date) {
  // Fixed time zone so the server (UTC on Vercel) and the browser render the same text.
  return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Chicago" });
}

/** Last modified stamp, archive (anyone) and delete (the three admins). */
export function RecordFooter({
  kind,
  id,
  lastModifiedAt,
  lastModifiedBy,
  archivedAt,
  canDelete,
}: {
  kind: EntityKind;
  id: string;
  lastModifiedAt: Date;
  lastModifiedBy: string | null;
  archivedAt: Date | null;
  canDelete: boolean;
}) {
  const [state, del, pending] = useActionState<DeleteState, FormData>(deleteAction, null);

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
      <span>
        Last modified {formatWhen(lastModifiedAt)}
        {lastModifiedBy && ` by ${lastModifiedBy}`}
        {archivedAt && <span className="ml-2 font-medium text-danger">Archived</span>}
      </span>
      <div className="flex items-center gap-4">
        <form action={archiveAction}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="archived" value={String(!archivedAt)} />
          <button type="submit" className="hover:text-foreground">
            {archivedAt ? "Unarchive" : "Archive"}
          </button>
        </form>
        {canDelete && (
          <form
            action={del}
            onSubmit={(e) => {
              if (!confirm("Permanently delete this record? This can't be undone. Use Archive for housekeeping.")) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="id" value={id} />
            <button type="submit" disabled={pending} className="text-danger hover:underline disabled:opacity-50">
              Delete
            </button>
          </form>
        )}
      </div>
      {state?.message && <p className="text-danger sm:basis-full">{state.message}</p>}
    </div>
  );
}
