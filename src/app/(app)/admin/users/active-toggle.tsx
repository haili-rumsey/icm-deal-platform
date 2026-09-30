"use client";

import { useFormStatus } from "react-dom";
import { setActiveAction } from "./actions";

function ToggleButton({ isActive, name }: { isActive: boolean; name: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        // Deactivating signs the person out everywhere, so it asks first.
        if (isActive && !confirm(`Deactivate ${name}? They'll be signed out immediately.`)) {
          e.preventDefault();
        }
      }}
      className={`disabled:opacity-50 ${isActive ? "text-danger hover:underline" : "text-accent hover:underline"}`}
    >
      {pending ? "Saving…" : isActive ? "Deactivate" : "Reactivate"}
    </button>
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
