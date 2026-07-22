"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  primaryButton,
  secondaryButton,
  eyebrowClass,
  errorTextClass,
} from "@/components/ui";
import { PhoneField } from "@/components/PhoneField";
import { normalizeUsPhone } from "@/lib/phone";
import { acceptRun, declineRun, type AcceptState } from "@/app/invite/[token]/actions";

interface Option {
  value: 1 | 2;
  label: string;
}

export function InviteForm({
  token,
  options,
  initiatorName,
  restaurantName,
}: {
  token: string;
  options: Option[];
  initiatorName: string;
  restaurantName: string;
}) {
  const timeErrorId = useId();
  const consentErrorId = useId();

  const [selected, setSelected] = useState<1 | 2 | null>(null);
  const [friendPhone, setFriendPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, formAction] = useActionState<AcceptState, FormData>(acceptRun, {});

  const serverErrors = state.fieldErrors ?? {};
  const timeError =
    selected != null ? undefined : serverErrors.selectedOption;
  const phoneError = normalizeUsPhone(friendPhone).ok
    ? undefined
    : serverErrors.friendPhone;
  const consentError = consent
    ? undefined
    : serverErrors.friendSmsConsent;

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="border-b border-border bg-cream/60 px-6 py-5">
        <p className={eyebrowClass}>Dremmt run</p>
        <h1 className="mt-1 text-2xl text-navy">
          {initiatorName} wants to go to {restaurantName} with you.
        </h1>
      </div>

      <div className="space-y-4 px-6 py-6">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="selectedOption" value={selected ?? ""} />

          <div>
            <p className="text-sm font-semibold text-navy">Pick what works:</p>
            <div
              className="mt-3 space-y-2"
              role="radiogroup"
              aria-label="Proposed times"
              aria-invalid={timeError ? true : undefined}
              aria-describedby={timeError ? timeErrorId : undefined}
            >
              {options.map((option) => {
                const isActive = selected === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => setSelected(option.value)}
                    className={`flex w-full min-h-14 items-center gap-3 rounded-full border px-5 py-3.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${
                      isActive
                        ? "border-sky-deep bg-sky/15 text-navy shadow-[0_0_0_1px_var(--color-sky-deep)]"
                        : "border-border-strong bg-cream text-navy hover:bg-surface"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        isActive
                          ? "bg-sky-deep"
                          : "bg-transparent ring-1 ring-border-strong"
                      }`}
                    />
                    <span className="font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>
            {timeError ? (
              <p
                id={timeErrorId}
                className={`mt-2 ${errorTextClass}`}
                role="alert"
              >
                {timeError}
              </p>
            ) : null}
          </div>

          <PhoneField
            id="friendPhone"
            name="friendPhone"
            label="Phone number"
            value={friendPhone}
            onChange={setFriendPhone}
            error={phoneError}
            helperText="For your day-of reminder only. Enter a 10-digit U.S. number."
            required
          />

          <div className="space-y-1.5">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="friendSmsConsent"
                className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-orange)]"
                checked={consent}
                aria-invalid={consentError ? true : undefined}
                aria-describedby={consentError ? consentErrorId : undefined}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span className="text-sm text-navy">
                I agree to receive texts from Dremmt about this plan.
              </span>
            </label>
            {consentError ? (
              <p
                id={consentErrorId}
                className={errorTextClass}
                role="alert"
              >
                {consentError}
              </p>
            ) : null}
          </div>

          {state.error ? <p className={errorTextClass}>{state.error}</p> : null}

          <ImInButton disabled={selected === null} />
        </form>

        <p className="text-sm text-muted">
          Pick a time and at least $6 toward the outing is locked to that date.
          Go then or miss it—so don&apos;t flake.
        </p>

        <form action={declineRun}>
          <input type="hidden" name="token" value={token} />
          <DeclineButton />
        </form>
      </div>
    </article>
  );
}

function ImInButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={`${primaryButton} w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy`}
      disabled={disabled || pending}
      aria-disabled={disabled || pending}
    >
      {pending ? "Locking it in…" : "I'm in"}
    </button>
  );
}

function DeclineButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={`${secondaryButton} w-full`}
      disabled={pending}
    >
      {pending ? "One sec…" : "Neither time works"}
    </button>
  );
}
