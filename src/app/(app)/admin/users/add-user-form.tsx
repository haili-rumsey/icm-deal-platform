"use client";

import { useActionState, useEffect, useRef } from "react";
import { addUserAction, type FormState } from "./actions";

export function AddUserForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addUserAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
        First name
        <input
          name="firstName"
          required
          className="rounded-sm border border-[#c8c8c4] bg-white px-2.5 py-1.5 outline-none focus:border-navy focus:ring-1 focus:ring-navy"
        />
      </label>
      <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
        Last name
        <input
          name="lastName"
          required
          className="rounded-sm border border-[#c8c8c4] bg-white px-2.5 py-1.5 outline-none focus:border-navy focus:ring-1 focus:ring-navy"
        />
      </label>
      <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
        Email
        <input
          name="email"
          type="email"
          required
          placeholder="name@streamrealty.com"
          className="rounded-sm border border-[#c8c8c4] bg-white px-2.5 py-1.5 outline-none focus:border-navy focus:ring-1 focus:ring-navy"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add user"}
      </button>
      {state && (
        <p className={`text-sm sm:basis-full ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p>
      )}
    </form>
  );
}
