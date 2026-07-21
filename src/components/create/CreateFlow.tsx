"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  primaryButton,
  secondaryButton,
  accentButton,
  inputClass,
  labelClass,
  hintClass,
  errorTextClass,
  eyebrowClass,
} from "@/components/ui";
import { PlanCard } from "@/components/PlanCard";
import { Scheduler, type SchedulerTab } from "@/components/create/Scheduler";
import { PhoneField } from "@/components/PhoneField";
import { comboToWindow, type DateTimeCombo } from "@/lib/time-windows";
import { normalizeUsPhone } from "@/lib/phone";
import { rewardConfig } from "@/config/reward";
import type { ReturningCreateContext } from "@/lib/returning-create-context";
import type { TimeWindow } from "@/lib/types";

const TOTAL_STEPS = 5;

type View = "steps" | "preview" | "paywall" | "allowance-reached";

export function CreateFlow({
  canceled,
  returningContext = null,
  restartMode = false,
}: {
  canceled: boolean;
  returningContext?: ReturningCreateContext | null;
  restartMode?: boolean;
}) {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [view, setView] = useState<View>("steps");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetDate, setResetDate] = useState<string | null>(null);
  const [reachedIsTrial, setReachedIsTrial] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [allowanceLimit, setAllowanceLimit] = useState(
    returningContext?.limit ?? rewardConfig.monthlyPlanLimit,
  );

  const [initiatorName, setInitiatorName] = useState(
    returningContext?.firstName ?? "",
  );
  const [friendName, setFriendName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantLink, setRestaurantLink] = useState("");
  const [location, setLocation] = useState("");

  // Scheduling sub-flow state (lifted so it survives moving between steps).
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [combos, setCombos] = useState<DateTimeCombo[]>([]);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [schedulerTab, setSchedulerTab] = useState<SchedulerTab>("days");

  const [personalMessage, setPersonalMessage] = useState("");
  const [initiatorPhone, setInitiatorPhone] = useState(
    returningContext?.phoneDisplay ?? "",
  );
  const [initiatorEmail, setInitiatorEmail] = useState(
    returningContext?.email ?? "",
  );
  const [consent, setConsent] = useState(false);

  const skipPaywall =
    Boolean(returningContext?.hasValidAccess) && !restartMode;

  const previewWindows: TimeWindow[] = useMemo(() => {
    const order = [...combos].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return order.map(comboToWindow);
  }, [combos]);

  function validateStep(current: number): boolean {
    const next: Record<string, string> = {};
    if (current === 1) {
      if (!initiatorName.trim()) next.initiatorName = "Add your first name.";
      if (!friendName.trim()) next.friendName = "Add your friend's first name.";
    }
    if (current === 2) {
      if (!restaurantName.trim())
        next.restaurantName = "Add the restaurant name.";
    }
    if (current === 5) {
      const phone = normalizeUsPhone(initiatorPhone);
      if (!phone.ok) next.initiatorPhone = phone.error;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(initiatorEmail.trim()))
        next.initiatorEmail = "Enter a valid email.";
      if (!consent)
        next.consent = "Please agree to receive texts about this Dremmt run.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    setFormError(null);
    if (!validateStep(step)) return;
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      setView("preview");
    }
  }

  function goBack() {
    setFormError(null);
    setErrors({});
    if (view === "paywall") {
      setView("preview");
      return;
    }
    if (view === "preview") {
      setView("steps");
      setStep(TOTAL_STEPS);
      return;
    }
    if (step > 1) setStep(step - 1);
  }

  function normalizeLink(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  async function submit() {
    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        initiatorName: initiatorName.trim(),
        friendName: friendName.trim(),
        restaurantName: restaurantName.trim(),
        restaurantLink: normalizeLink(restaurantLink) || undefined,
        location: location.trim() || undefined,
        timeOptionOne: previewWindows[0],
        timeOptionTwo: previewWindows[1] ?? null,
        personalMessage: personalMessage.trim() || undefined,
        initiatorPhone: initiatorPhone.trim(),
        initiatorEmail: initiatorEmail.trim(),
        initiatorSmsConsent: consent,
      };

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setFormError(
          data?.error ?? "Something went wrong. Please review the plan and retry.",
        );
        setSubmitting(false);
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      if (data.allowanceReached) {
        setResetDate(data.resetDate ?? null);
        setReachedIsTrial(Boolean(data.isTrial));
        if (typeof data.allowanceLimit === "number") {
          setAllowanceLimit(data.allowanceLimit);
        }
        setView("allowance-reached");
        setSubmitting(false);
        return;
      }
      if (data.shareToken) {
        router.push(`/checkout/success?token=${data.shareToken}`);
        return;
      }
      setFormError("Unexpected response. Please try again.");
      setSubmitting(false);
    } catch {
      setFormError("We couldn't reach the server. Please try again.");
      setSubmitting(false);
    }
  }

  function handleContinueFromPreview() {
    // Returning members with valid access skip the paywall; Checkout still
    // revalidates by submitted phone on the server.
    if (skipPaywall) {
      void submit();
      return;
    }
    setView("paywall");
  }

  if (view === "allowance-reached") {
    return (
      <section className="rounded-lg border border-border bg-surface p-7 shadow-[var(--shadow-card)]">
        {reachedIsTrial ? (
          <>
            <h1 className="text-2xl text-navy">
              You&apos;ve used your free trial plan
            </h1>
            <p className="mt-3 text-navy">
              Your trial includes one rewarded plan. Once your membership
              begins, you&apos;ll get {rewardConfig.monthlyPlanLimit} rewarded
              plans every calendar month.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl text-navy">
              You&apos;ve used all {allowanceLimit} plans this month
            </h1>
            <p className="mt-3 text-navy">
              Your membership is active, but you&apos;ve already locked in{" "}
              {allowanceLimit} rewarded plans this month.
            </p>
            {resetDate ? (
              <p className="mt-2 text-navy">
                Your plans reset on <strong>{resetDate}</strong>.
              </p>
            ) : null}
          </>
        )}
        <p className="mt-4 text-sm text-muted">
          Need something sooner? Contact Dremmt during the pilot.
        </p>
      </section>
    );
  }

  return (
    <section>
      {canceled ? (
        <p className="mb-6 rounded-md border border-border-strong bg-cream px-4 py-3 text-sm text-navy">
          Checkout was canceled. Your plan is still here — continue when
          you&apos;re ready.
        </p>
      ) : null}

      {returningContext?.hasValidAccess ? (
        <p className="mb-6 rounded-md border border-border bg-surface px-4 py-3 text-sm text-navy">
          {returningContext.isTrial
            ? returningContext.remaining > 0
              ? "1 free plan available during your trial"
              : "You've used your trial plan"
            : returningContext.limitReached
              ? `0 of ${returningContext.limit} plans left this month`
              : `${returningContext.remaining} of ${returningContext.limit} plans left this month`}
        </p>
      ) : null}

      {view === "steps" ? (
        <>
          <Progress step={step} />
          <div className="mt-6">
            {step === 1 ? (
              <Fieldset
                heading="Who are you trying to get out of the group chat?"
                hint="First names are enough."
              >
                <Field
                  id="initiatorName"
                  label="Your first name"
                  error={errors.initiatorName}
                >
                  <input
                    id="initiatorName"
                    className={inputClass}
                    value={initiatorName}
                    autoComplete="given-name"
                    onChange={(e) => setInitiatorName(e.target.value)}
                  />
                </Field>
                <Field
                  id="friendName"
                  label="Your friend's first name"
                  error={errors.friendName}
                >
                  <input
                    id="friendName"
                    className={inputClass}
                    value={friendName}
                    onChange={(e) => setFriendName(e.target.value)}
                  />
                </Field>
              </Fieldset>
            ) : null}

            {step === 2 ? (
              <Fieldset
                heading="Where are you two going?"
                hint="You choose the spot — Dremmt doesn't pick restaurants."
              >
                <Field
                  id="restaurantName"
                  label="Restaurant name"
                  error={errors.restaurantName}
                >
                  <input
                    id="restaurantName"
                    className={inputClass}
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                  />
                </Field>
                <Field
                  id="restaurantLink"
                  label="Restaurant or map link"
                  optional
                >
                  <input
                    id="restaurantLink"
                    className={inputClass}
                    inputMode="url"
                    placeholder="maps.google.com/…"
                    value={restaurantLink}
                    onChange={(e) => setRestaurantLink(e.target.value)}
                  />
                </Field>
                <Field
                  id="location"
                  label="Neighborhood or city"
                  optional
                >
                  <input
                    id="location"
                    className={inputClass}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </Field>
              </Fieldset>
            ) : null}

            {step === 3 ? (
              <Scheduler
                selectedDates={selectedDates}
                setSelectedDates={setSelectedDates}
                combos={combos}
                setCombos={setCombos}
                activeDate={activeDate}
                setActiveDate={setActiveDate}
                tab={schedulerTab}
                setTab={setSchedulerTab}
                onBackToPreviousStep={() => setStep(2)}
                onContinue={() => setStep(4)}
              />
            ) : null}

            {step === 4 ? (
              <Fieldset
                heading={`Anything you want to say to ${friendName.trim() || "your friend"}?`}
                hint="Optional — a nudge helps."
              >
                <Field id="personalMessage" label="Your message" optional>
                  <textarea
                    id="personalMessage"
                    className={`${inputClass} min-h-28 resize-y`}
                    maxLength={400}
                    placeholder="We have been saying we're going here for three months 😭"
                    value={personalMessage}
                    onChange={(e) => setPersonalMessage(e.target.value)}
                  />
                </Field>
              </Fieldset>
            ) : null}

            {step === 5 ? (
              <Fieldset
                heading="Where should Dremmt reach you?"
                hint="Dremmt will use this information for this plan, membership updates, and your day-of reminder."
              >
                <PhoneField
                  id="initiatorPhone"
                  label="Phone number"
                  value={initiatorPhone}
                  onChange={setInitiatorPhone}
                  error={errors.initiatorPhone}
                />
                <Field
                  id="initiatorEmail"
                  label="Your email"
                  error={errors.initiatorEmail}
                >
                  <input
                    id="initiatorEmail"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    className={inputClass}
                    value={initiatorEmail}
                    onChange={(e) => setInitiatorEmail(e.target.value)}
                  />
                </Field>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-orange)]"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span className="text-sm text-navy">
                    I agree to receive texts from Dremmt about this Dremmt run,
                    including my day-of reminder.
                  </span>
                </label>
                {errors.consent ? (
                  <p className={errorTextClass}>{errors.consent}</p>
                ) : null}
              </Fieldset>
            ) : null}
          </div>

          {step !== 3 ? (
            <StepNav
              onBack={step > 1 ? goBack : undefined}
              onNext={goNext}
              nextLabel={step === TOTAL_STEPS ? "Review plan" : "Continue"}
            />
          ) : null}
        </>
      ) : null}

      {view === "preview" ? (
        <div className="space-y-6">
          <div>
            <p className={eyebrowClass}>Preview</p>
            <h1 className="mt-1 text-2xl text-navy">
              Here&apos;s the invitation {friendName.trim() || "your friend"} will
              get
            </h1>
          </div>
          <PlanCard
            friendName={friendName.trim() || "your friend"}
            restaurantName={restaurantName.trim()}
            location={location.trim() || null}
            restaurantLink={normalizeLink(restaurantLink) || null}
            windows={previewWindows}
            personalMessage={personalMessage.trim() || null}
          />
          <p className="text-navy">
            Once {friendName.trim() || "your friend"} says they&apos;re in, at
            least $6 toward the outing locks to that date.
          </p>
          {formError ? <p className={errorTextClass}>{formError}</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" className={secondaryButton} onClick={goBack}>
              Edit plan
            </button>
            <button
              type="button"
              className={primaryButton}
              onClick={handleContinueFromPreview}
              disabled={submitting}
            >
              {submitting ? "Working…" : "Continue"}
            </button>
          </div>
        </div>
      ) : null}

      {view === "paywall" ? (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl text-navy sm:text-3xl">
              {restartMode || returningContext?.isRestart
                ? "Restart your membership."
                : "Try your first plan free for 14 days."}
            </h1>
            <p className="mt-3 text-lg text-navy">
              {restartMode || returningContext?.isRestart
                ? "Membership is $10/month. Your first rewarded plan during a prior trial does not reduce your paid monthly allowance."
                : "You won't be charged today. After 14 days, membership is $10/month unless you cancel."}
            </p>
            <p className="mt-2 text-navy">
              Your membership includes {rewardConfig.monthlyPlanLimit} rewarded
              plans each calendar month
              {restartMode || returningContext?.isRestart
                ? "."
                : " after the trial."}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
            {restartMode || returningContext?.isRestart ? (
              <>
                <p className="text-3xl font-semibold text-navy">$10/month</p>
                <p className="mt-1 text-navy">
                  {rewardConfig.monthlyPlanLimit} rewarded plans each calendar
                  month
                </p>
              </>
            ) : (
              <>
                <p className="text-3xl font-semibold text-navy">
                  Free for {rewardConfig.trialDays} days
                </p>
                <p className="mt-1 text-navy">then $10/month</p>
              </>
            )}
            <ul className="mt-4 space-y-2 text-navy">
              <li>
                · {rewardConfig.monthlyPlanLimit} rewarded plans each calendar
                month
                {restartMode || returningContext?.isRestart
                  ? ""
                  : " after the trial"}
              </li>
              {!restartMode && !returningContext?.isRestart ? (
                <li>· 1 plan during your 14-day trial</li>
              ) : null}
              <li>· At least $6 toward each completed outing</li>
              <li>· Invited friends always join free</li>
              <li>· Declined plans do not count</li>
              <li>· Cancel anytime</li>
            </ul>
          </div>
          {formError ? <p className={errorTextClass}>{formError}</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" className={secondaryButton} onClick={goBack}>
              Back
            </button>
            <button
              type="button"
              className={accentButton}
              onClick={submit}
              disabled={submitting}
            >
              {submitting
                ? "Redirecting to checkout…"
                : restartMode || returningContext?.isRestart
                  ? "Restart membership"
                  : "Try your first plan free"}
            </button>
          </div>
          <p className={hintClass}>
            {restartMode || returningContext?.isRestart
              ? "Payment is handled securely by Stripe. Prior trial history is not automatically renewed."
              : "Card required. You won't be charged during the 14-day trial. Cancel before it ends and you pay nothing. Payment is handled securely by Stripe."}
          </p>
          <p className="text-sm text-muted">
            <Link href="/manage-membership" className="underline underline-offset-4">
              Manage or cancel membership
            </Link>
          </p>
        </div>
      ) : null}
    </section>
  );
}

function Progress({ step }: { step: number }) {
  const pct = Math.round((step / TOTAL_STEPS) * 100);
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className={eyebrowClass}>
          Step {step} of {TOTAL_STEPS}
        </p>
        <p className="text-sm text-muted">{pct}%</p>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
      >
        <div className="h-full rounded-full bg-orange" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Fieldset({
  heading,
  hint,
  children,
}: {
  heading: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-2xl text-navy">{heading}</h1>
      {hint ? <p className="mt-2 text-muted">{hint}</p> : null}
      <div className="mt-6 space-y-5">{children}</div>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  optional,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
        {optional ? <span className="font-normal text-muted"> (optional)</span> : null}
      </label>
      {children}
      {error ? <p className={errorTextClass}>{error}</p> : null}
    </div>
  );
}

function StepNav({
  onBack,
  onNext,
  nextLabel,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
}) {
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse">
      <button type="button" className={primaryButton} onClick={onNext}>
        {nextLabel}
      </button>
      {onBack ? (
        <button type="button" className={secondaryButton} onClick={onBack}>
          Back
        </button>
      ) : null}
    </div>
  );
}
