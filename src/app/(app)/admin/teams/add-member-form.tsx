"use client";

import { useActionState, useEffect, useRef } from "react";
import { inputCls } from "@/components/fields";
import { LOCATIONS } from "@/domain/options";
import { addTeamMemberAction, type TeamFormState } from "./actions";

export function AddMemberForm() {
  const [state, action, pending] = useActionState<TeamFormState, FormData>(addTeamMemberAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
        First name
        <input name="firstName" required className={inputCls} />
      </label>
      <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
        Last name
        <input name="lastName" required className={inputCls} />
      </label>
      <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
        Email
        <input name="email" type="email" required placeholder="name@streamrealty.com" className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted sm:w-36">
        Location
        <select name="location" defaultValue="" className={inputCls}>
          <option value="">—</option>
          {LOCATIONS.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-sm bg-navy px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add to team"}
      </button>
      {state && <p className={`text-sm sm:basis-full ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p>}
    </form>
  );
}
