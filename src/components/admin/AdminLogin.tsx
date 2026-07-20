"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  primaryButton,
  inputClass,
  labelClass,
  errorTextClass,
} from "@/components/ui";
import { loginAdmin, type AdminLoginState } from "@/app/admin/actions";

export function AdminLogin() {
  const [state, formAction] = useActionState<AdminLoginState, FormData>(
    loginAdmin,
    {},
  );

  return (
    <form
      action={formAction}
      className="mx-auto max-w-sm space-y-4 rounded-lg border border-border bg-surface p-7 shadow-[var(--shadow-card)]"
    >
      <h1 className="text-2xl text-navy">Pilot admin</h1>
      <div className="space-y-1.5">
        <label htmlFor="password" className={labelClass}>
          Admin password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>
      {state.error ? <p className={errorTextClass}>{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={primaryButton} disabled={pending}>
      {pending ? "Checking…" : "Enter dashboard"}
    </button>
  );
}
