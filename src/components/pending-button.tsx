"use client";

import { useFormStatus } from "react-dom";

/** A submit button that shows it's working, so a slow save doesn't look like nothing happened. */
export function PendingButton({
  children,
  pendingLabel = "Saving…",
  className,
  formAction,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  formAction?: (fd: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} formAction={formAction} className={`${className ?? ""} disabled:opacity-50`}>
      {pending ? pendingLabel : children}
    </button>
  );
}
