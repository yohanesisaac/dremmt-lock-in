import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/ui";
import { rewardConfig } from "@/config/reward";

export const metadata = {
  title: "Terms & membership — Dremmt Lock-In",
};

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl space-y-5 px-5 py-12 sm:px-8">
          <h1 className="text-3xl text-navy">Terms &amp; membership (pilot)</h1>
          <p className="text-muted">
            Straightforward terms for the Dremmt Lock-In pilot.
          </p>

          <div className="space-y-2">
            <h2 className="text-xl text-navy">Free trial</h2>
            <p className="text-navy">
              New members get a {rewardConfig.trialDays}-day free trial. A card
              is required at checkout, but you are not charged during the trial.
              Membership of $10/month begins automatically after the trial
              unless you cancel before it ends.
            </p>
            <p className="text-navy">
              During the trial you can activate one completed rewarded plan in
              total. Declined invitations and time conflicts do not use that
              plan.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl text-navy">Membership</h2>
            <p className="text-navy">
              After the trial, Dremmt membership is $10 per month. Active
              membership includes {rewardConfig.monthlyPlanLimit} rewarded,
              accepted plans per calendar month, each with at least{" "}
              {rewardConfig.guaranteedMinimumLabel} toward the outing during the
              pilot. Invited friends join for free and never pay. Declined
              invitations do not count toward your monthly allowance. Your trial
              plan does not reduce the later paid monthly allowance.
            </p>
            <p className="text-navy">
              Your monthly allowance resets on the first of each calendar month.
              If you&apos;ve already completed {rewardConfig.monthlyPlanLimit}{" "}
              plans this month, you can still make a plan — it just won&apos;t
              carry the reward until your allowance resets.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl text-navy">The reward</h2>
            <p className="text-navy">
              {rewardConfig.promise} The guaranteed minimum is{" "}
              {rewardConfig.guaranteedMinimumLabel}; some plans may receive a
              surprise amount above that. The amount is not based on which
              restaurant you choose during the pilot.
            </p>
            <p className="text-navy">
              The reward — &ldquo;{rewardConfig.title}&rdquo; — is provided by
              Dremmt during the pilot. It is not funded or provided by the
              restaurant. It is a small extra push to help two friends follow
              through; it is not the point of the plan.
            </p>
            <p className="text-navy">
              A plan is completed by sharing one photo — food, table, or the
              two of you. {rewardConfig.photoNote} No receipt is required.{" "}
              {rewardConfig.deliveryNote}
            </p>
            <p className="text-navy">
              A plan that is declined or ends in a time conflict does not use
              any of your allowance. The reward is only reserved once your
              friend accepts a proposed window.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl text-navy">Reservations</h2>
            <p className="text-navy">
              Dremmt does not reserve or hold a table. If a restaurant requires a
              reservation, make one separately.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl text-navy">Cancellation</h2>
            <p className="text-navy">
              You can cancel anytime through Stripe&apos;s customer portal. No
              Dremmt profile or password is required — open{" "}
              <Link
                href="/manage-membership"
                className="underline underline-offset-4"
              >
                Manage or cancel membership
              </Link>
              , use the email you checked out with, and Stripe will send a
              one-time code.
            </p>
            <p className="text-navy">
              Cancel before your free trial ends and you will not be charged.
              If you cancel after billing has started, access continues through
              the end of the current billing period unless otherwise stated in
              the portal.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl text-navy">Pilot scope</h2>
            <p className="text-navy">
              This is an early pilot. Features and reward details may change, and
              some steps (like reminders) are handled manually by a person at
              Dremmt.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
