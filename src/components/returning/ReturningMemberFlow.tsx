"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  accentButton,
  ghostButton,
  primaryButton,
  secondaryButton,
  hintClass,
} from "@/components/ui";
import { PhoneField } from "@/components/PhoneField";
import { normalizeUsPhone } from "@/lib/phone";
import type { ReturningMemberView } from "@/lib/returning-member";

type Phase = "entry" | "status";

export function ReturningMemberFlow() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("entry");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<ReturningMemberView | null>(null);

  async function clearContext() {
    try {
      await fetch("/api/returning-member", { method: "DELETE" });
    } catch {
      // Best-effort clear.
    }
  }

  async function onContinue(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const normalized = normalizeUsPhone(phone);
    if (!normalized.ok) {
      setError(normalized.error);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/returning-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      setView(data.view as ReturningMemberView);
      setPhase("status");
      setSubmitting(false);
    } catch {
      setError("We couldn't reach the server. Please try again.");
      setSubmitting(false);
    }
  }

  async function startNewMembership() {
    await clearContext();
    router.push("/create");
  }

  if (phase === "status" && view) {
    return <StatusScreen view={view} onTryAnother={() => {
      setPhase("entry");
      setView(null);
      setError(null);
      setPhone("");
    }} onStartNew={startNewMembership} />;
  }

  return (
    <section className="mx-auto w-full max-w-md text-center">
      <h1 className="text-3xl text-navy">Welcome back.</h1>
      <p className="mt-3 text-navy">
        Enter the phone number you used with Dremmt.
      </p>

      <form onSubmit={onContinue} className="mt-8 space-y-5 text-left">
        <PhoneField
          id="returningPhone"
          value={phone}
          onChange={setPhone}
          error={error ?? undefined}
        />
        <button
          type="submit"
          className={`${primaryButton} w-full`}
          disabled={submitting}
        >
          {submitting ? "Checking…" : "Continue"}
        </button>
      </form>

      <p className="mt-6">
        <button
          type="button"
          className={ghostButton}
          onClick={startNewMembership}
        >
          Start a new membership
        </button>
      </p>
    </section>
  );
}

function StatusScreen({
  view,
  onTryAnother,
  onStartNew,
}: {
  view: ReturningMemberView;
  onTryAnother: () => void;
  onStartNew: () => void;
}) {
  if (view.kind === "not_found") {
    return (
      <section className="mx-auto w-full max-w-md text-center">
        <h1 className="text-2xl text-navy">
          We couldn&apos;t find a membership with that number.
        </h1>
        <div className="mt-8 flex flex-col gap-3">
          <button type="button" className={primaryButton} onClick={onTryAnother}>
            Try another number
          </button>
          <button type="button" className={secondaryButton} onClick={onStartNew}>
            Start a new membership
          </button>
        </div>
      </section>
    );
  }

  if (view.kind === "inactive") {
    return (
      <section className="mx-auto w-full max-w-md text-center">
        <h1 className="text-2xl text-navy">Your membership isn&apos;t active.</h1>
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/create?restart=1" className={accentButton}>
            Restart membership
          </Link>
          <Link href="/manage-membership" className={secondaryButton}>
            Manage membership
          </Link>
        </div>
      </section>
    );
  }

  // active
  if (view.isTrial) {
    return (
      <section className="mx-auto w-full max-w-md space-y-5 text-center">
        <h1 className="text-2xl text-navy">Your trial is active.</h1>
        <p className="text-navy">1 trial plan total</p>
        <p className="text-lg text-navy">
          {view.remaining > 0
            ? "You have 1 trial plan left."
            : "You've used your trial plan."}
        </p>
        <p className={hintClass}>
          The trial includes one rewarded plan during the 14-day period.
        </p>
        {view.remaining > 0 ? (
          <Link href="/create?returning=1" className={primaryButton}>
            Make another plan
          </Link>
        ) : null}
        <div>
          <Link href="/manage-membership" className={ghostButton}>
            Manage membership
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-md space-y-5 text-center">
      <h1 className="text-2xl text-navy">Welcome back.</h1>
      {view.limitReached ? (
        <>
          <p className="text-lg text-navy">
            You&apos;ve used all 3 plans for this month.
          </p>
          <p className={hintClass}>
            Your allowance resets next calendar month.
          </p>
        </>
      ) : (
        <p className="text-lg text-navy">
          You have {view.remaining} of 3 plans left this month.
        </p>
      )}
      {view.remaining > 0 ? (
        <Link href="/create?returning=1" className={primaryButton}>
          Make another plan
        </Link>
      ) : null}
      <div>
        <Link href="/manage-membership" className={secondaryButton}>
          Manage membership
        </Link>
      </div>
    </section>
  );
}
