"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { useConfirm } from "@/components/confirm-dialog";
import { setActiveAction } from "./actions";

function ToggleButton({ isActive, name }: { isActive: boolean; name: string }) {
  const { pending } = useFormStatus();
  const [confirm, confirmDialog] = useConfirm();
  const confirmed = useRef(false);
  return (
    <>
    {confirmDialog}
    <button
      type="submit"
      disabled={pending}
      onClick={async (e) => {
        // Deactivating signs the person out everywhere, so it asks first.
        if (!isActive || confirmed.current) {
          confirmed.current = false;
          return;
        }
        e.preventDefault();
        const form = e.currentTarget.form;
        const ok = await confirm({
          title: `Deactivate ${name}?`,
          message: "They'll be signed out everywhere immediately and won't be able to request a sign-in link. You can reactivate them later.",
          confirmLabel: "Deactivate",
          danger: true,
        });
        if (ok && form) {
          confirmed.current = true;
          form.requestSubmit();
        }
      }}
      className={`disabled:opacity-50 ${isActive ? "text-danger hover:underline" : "text-accent hover:underline"}`}
    >
      {pending ? "Saving…" : isActive ? "Deactivate" : "Reactivate"}
    </button>
    </>
  );
}

export function ActiveToggle({ userId, isActive, name }: { userId: string; isActive: boolean; name: string }) {
  return (
    <form action={setActiveAction}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="active" value={String(!isActive)} />
      <ToggleButton isActive={isActive} name={name} />
    </form>
  );
}
