"use client";

import { useActionState, useEffect, useRef } from "react";
import { inputCls } from "@/components/fields";
import type { GeoFormState } from "./actions";

/** One-field add form (a city or a submarket) that clears itself on success. */
export function InlineAdd({
  name,
  placeholder,
  buttonLabel,
  action,
}: {
  name: string;
  placeholder: string;
  buttonLabel: string;
  action: (prev: GeoFormState, fd: FormData) => Promise<GeoFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={formAction} className="flex flex-wrap items-center gap-2">
      <input name={name} placeholder={placeholder} required className={`${inputCls} w-56`} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-sm border border-navy px-3 py-1.5 text-sm font-semibold text-navy hover:bg-hover disabled:opacity-50"
      >
        {pending ? "Adding…" : buttonLabel}
      </button>
      {state && <span className={`text-sm ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</span>}
    </form>
  );
}
