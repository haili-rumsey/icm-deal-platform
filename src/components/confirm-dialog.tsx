"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ConfirmOptions = {
  title: string;
  message: string;
  /** The button that goes ahead (secondary styling). Leave out for an information-only box. */
  confirmLabel?: string;
  /** Bulleted list under the message. */
  items?: string[];
  cancelLabel?: string;
  /** Red confirm button for permanent actions. */
  danger?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

/**
 * Stream-styled replacement for the browser's confirm(). Cancel is the dark, default
 * button: Enter or Esc keeps you where you are.
 *
 *   const [confirm, dialog] = useConfirm();
 *   if (await confirm({ ... })) doIt();
 *   return <>{dialog} ...</>;
 */
export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })),
    [],
  );

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (pending && !d.open) {
      d.showModal();
      cancelRef.current?.focus();
    } else if (!pending && d.open) {
      d.close();
    }
  }, [pending]);

  function finish(ok: boolean) {
    pending?.resolve(ok);
    setPending(null);
  }

  const dialog = (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        finish(false);
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-md border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/40"
    >
      {pending && (
        <div className="flex flex-col gap-3 p-6">
          <h2 className="font-serif text-xl">{pending.title}</h2>
          <p className="text-base leading-relaxed">{pending.message}</p>
          {pending.items && pending.items.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-6 text-base">
              {pending.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {pending.confirmLabel && (
            <button
              type="button"
              onClick={() => finish(true)}
              className={`rounded-sm border px-4 py-2 text-base font-semibold ${
                pending.danger ? "border-danger text-danger hover:bg-[#fbeaea]" : "border-gray text-gray-dark hover:bg-hover"
              }`}
            >
              {pending.confirmLabel}
            </button>
            )}
            <button
              ref={cancelRef}
              type="button"
              onClick={() => finish(false)}
              className="rounded-sm bg-navy px-5 py-2 text-base font-semibold text-white hover:opacity-90"
            >
              {pending.cancelLabel ?? "Cancel"}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );

  return [confirm, dialog] as const;
}
