"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  primaryButton,
  secondaryButton,
  ghostButton,
  errorTextClass,
} from "@/components/ui";
import { PhoneField } from "@/components/PhoneField";
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
  const [friendPhone, setFriendPhone] = useState("");
  const [state, formAction] = useActionState<AcceptState, FormData>(acceptRun, {});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl text-navy">Click a time below</h2>
        <div
          className="mt-4 space-y-3"
          role="radiogroup"
          aria-label="Proposed times"
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
                className={`flex w-full min-h-14 items-center justify-between rounded-full border px-5 py-4 text-left text-lg transition-colors ${
                  isActive
                    ? "border-sky-deep bg-sky/15 text-navy shadow-[0_0_0_1px_var(--color-sky-deep)]"
                    : "border-border-strong bg-cream text-navy hover:bg-surface"
                }`}
              >
                <span className="font-semibold">{option.label}</span>
                <span
                  aria-hidden
                  className={`ml-4 h-2.5 w-2.5 shrink-0 rounded-full ${
                    isActive
                      ? "bg-sky-deep"
                      : "bg-transparent ring-1 ring-border-strong"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-navy">
          At least $6 is yours if you go during the time you both agree on.
        </p>
        <p className="text-sm text-muted">
          Miss the window and it disappears—so don&apos;t flake.
        </p>
      </div>

      {phase === "choosing" ? (
        <div className="space-y-3">
          <button
            type="button"
            className={primaryButton}
            disabled={selected === null}
            aria-disabled={selected === null}
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

          <PhoneField
            id="friendPhone"
            name="friendPhone"
            label="Phone number"
            value={friendPhone}
            onChange={setFriendPhone}
            helperText="For your day-of reminder only. Enter a 10-digit U.S. number."
            required
          />

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="friendSmsConsent"
              className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-orange)]"
            />
            <span className="text-sm text-navy">
              I agree to receive texts from Dremmt about this run.
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
