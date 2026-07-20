"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  primaryButton,
  secondaryButton,
  ghostButton,
  inputClass,
  labelClass,
  errorTextClass,
} from "@/components/ui";
import { acceptRun, declineRun, type AcceptState } from "@/app/invite/[token]/actions";

interface Option {
  value: 1 | 2;
  label: string;
}

export function InviteForm({
  token,
  options,
}: {
  token: string;
  options: Option[];
}) {
  const [selected, setSelected] = useState<1 | 2 | null>(null);
  const [phase, setPhase] = useState<"choosing" | "confirming">("choosing");
  const [state, formAction] = useActionState<AcceptState, FormData>(acceptRun, {});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl text-navy">Pick what works:</h2>
        <div className="mt-3 space-y-3" role="radiogroup" aria-label="Proposed times">
          {options.map((option) => {
            const isActive = selected === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setSelected(option.value)}
                className={`flex w-full min-h-14 items-center justify-between rounded-full border px-5 py-3.5 text-left text-lg transition-colors ${
                  isActive
                    ? "border-sky-deep bg-sky/10 text-navy"
                    : "border-border-strong bg-cream text-navy hover:bg-surface"
                }`}
              >
                <span className="font-medium">{option.label}</span>
                <span
                  aria-hidden
                  className={`ml-4 h-2.5 w-2.5 shrink-0 rounded-full ${
                    isActive ? "bg-sky-deep" : "bg-transparent ring-1 ring-border-strong"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-navy">
        Pick a time and at least $6 toward the outing is locked to that date. Go
        then or miss it—so don&apos;t flake.
      </p>

      {phase === "choosing" ? (
        <div className="space-y-3">
          <button
            type="button"
            className={primaryButton}
            disabled={selected === null}
            onClick={() => setPhase("confirming")}
          >
            I&apos;m in
          </button>

          <form action={declineRun}>
            <input type="hidden" name="token" value={token} />
            <DeclineButton />
          </form>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="selectedOption" value={selected ?? ""} />

          <p className="text-navy">
            Where should we send your confirmation and optional day-of reminder?
          </p>

          <div className="space-y-1.5">
            <label htmlFor="friendPhone" className={labelClass}>
              Your phone number
            </label>
            <input
              id="friendPhone"
              name="friendPhone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              className={inputClass}
            />
          </div>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="friendSmsConsent"
              className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-orange)]"
            />
            <span className="text-sm text-navy">
              I agree to receive texts from Dremmt about this specific Dremmt run.
            </span>
          </label>

          {state.error ? <p className={errorTextClass}>{state.error}</p> : null}

          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <LockItInButton />
            <button
              type="button"
              className={ghostButton}
              onClick={() => setPhase("choosing")}
            >
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function LockItInButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={primaryButton} disabled={pending}>
      {pending ? "Locking it in…" : "Lock it in"}
    </button>
  );
}

function DeclineButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={secondaryButton} disabled={pending}>
      {pending ? "One sec…" : "Neither time works"}
    </button>
  );
}
