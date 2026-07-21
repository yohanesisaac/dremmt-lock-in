import Link from "next/link";
import {
  SiteHeader,
  SiteFooter,
  primaryButton,
  secondaryButton,
  accentButton,
  eyebrowClass,
} from "@/components/ui";
import { MoreDetails } from "@/components/MoreDetails";
import { rewardConfig } from "@/config/reward";

const howItWorksSteps = [
  {
    title: "Make the plan",
    body: "Add the friend, restaurant, and the days that could work.",
  },
  {
    title: "They say “I’m in”",
    body: "They open one link, choose the time, and lock it in.",
  },
  {
    title: "Go and let the camera eat",
    body: "Show up during the chosen window, send one photo from the meal, and Dremmt sends at least $6 toward the outing.",
  },
];

const membershipBenefits = [
  "3 rewarded plans each calendar month",
  "1 plan during your 14-day trial",
  "At least $6 toward each completed outing",
  "Invited friends always join free",
  "Declined plans do not count",
  "Cancel anytime",
];

export default function LandingPage() {
  return (
    <>
      <SiteHeader showNav />
      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto w-full max-w-5xl px-5 pt-14 pb-10 sm:px-8 sm:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className={eyebrowClass}>For the plan that never leaves the gc</p>
              <h1 className="mt-3 text-4xl leading-tight text-navy sm:text-5xl">
                Pick the place. Pick the day. We&apos;ll give you a reason to
                go.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-navy">
                Send it to the friend you&apos;ve been meaning to see. Once
                they tap &ldquo;I&apos;m in,&rdquo; at least $6 toward the
                outing is locked to that date. Go then or it disappears—so
                don&apos;t flake.
              </p>
              <div className="mt-8">
                <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-stretch">
                  <Link
                    href="/create"
                    className={`${primaryButton} w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy sm:w-auto sm:min-w-[10.5rem]`}
                  >
                    Start free trial
                  </Link>
                  <Link
                    href="/returning-member"
                    className={`${secondaryButton} w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy sm:w-auto sm:min-w-[10.5rem]`}
                  >
                    I&apos;m already a member
                  </Link>
                </div>
                <p className="mt-3 text-sm text-muted">
                  First plan free for 14 days · then $10/month · 3 plans per
                  month · friends join free
                </p>
              </div>
            </div>

            <div className="lg:pl-4">
              <p className={`${eyebrowClass} mb-3`}>
                This is all your friend has to do
              </p>
              <ExampleInvitationCard />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="scroll-mt-24 border-y border-border bg-surface"
        >
          <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8">
            <h2 className="text-2xl text-navy sm:text-3xl">
              From &ldquo;we should go&rdquo; to &ldquo;see you Tuesday.&rdquo;
            </h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-3">
              {howItWorksSteps.map((step, index) => (
                <li key={step.title} className="flex flex-col gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange text-lg font-semibold text-white">
                    {index + 1}
                  </span>
                  <h3 className="text-xl text-navy">{step.title}</h3>
                  <p className="text-muted">{step.body}</p>
                </li>
              ))}
            </ol>

            <p className="mt-10 max-w-2xl text-lg text-navy">
              No receipts. No points. No coupon hunting.
            </p>
          </div>
        </section>

        <MoreDetails />

        {/* Membership */}
        <section className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8">
          <div className="mx-auto max-w-xl rounded-lg border border-border bg-surface p-7 shadow-[var(--shadow-card)] sm:p-9">
            <h2 className="text-2xl text-navy sm:text-3xl">
              Three little reasons to get out every month.
            </h2>
            <p className="mt-4 text-lg font-medium text-navy">
              Try your first plan free for 14 days.
            </p>
            <p className="mt-1 text-4xl font-semibold text-navy">Then $10/month</p>
            <ul className="mt-5 space-y-2 text-navy">
              {membershipBenefits.map((benefit) => (
                <li key={benefit}>· {benefit}</li>
              ))}
            </ul>
            <div className="mt-7">
              <Link href="/create" className={accentButton}>
                Try your first plan free
              </Link>
            </div>
            <p className="mt-3 text-sm text-muted">
              Card required. You won&apos;t be charged during the 14-day trial.
              Cancel before it ends and you pay nothing. Your first rewarded
              plan is included in the trial.
            </p>
            <p className="mt-4 text-sm text-muted">
              <Link
                href="/manage-membership"
                className="underline underline-offset-4"
              >
                Manage or cancel membership
              </Link>
            </p>
            <p className="mt-6 text-sm text-muted">
              Dremmt does not reserve a table. Make a separate restaurant
              reservation when one is required.
            </p>
          </div>
        </section>

        {/* Why the membership */}
        <section id="why-10" className="scroll-mt-24 border-y border-border bg-surface">
          <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8">
            <h2 className="text-2xl text-navy sm:text-3xl">So why $10?</h2>
            <p className="mt-4 text-lg text-navy">
              Your membership helps cover the little something we send after
              each completed plan—and helps get more people through the doors of
              independent restaurants.
            </p>
            <p className="mt-4 text-lg text-navy">
              The perk is not the whole point. But sometimes a little push is
              all we need to finally do the things we already wanted to do.
            </p>
          </div>
        </section>

        {/* Differentiation */}
        <section className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8">
          <h2 className="text-2xl text-navy sm:text-3xl">
            Not a coupon hunt. Not a points game.
          </h2>
          <p className="mt-4 text-lg text-navy">
            You choose the restaurant you actually want to visit. Dremmt is
            not giving you a list of deals. We just add a reason to go to the
            place you already had in mind.
          </p>
        </section>

        {/* Photo section */}
        <section className="border-y border-border bg-surface">
          <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8">
            <h2 className="text-2xl text-navy sm:text-3xl">
              {rewardConfig.photoHeading}
            </h2>
            <p className="mt-4 text-lg text-navy">
              {rewardConfig.photoDescription}
            </p>
            <p className="mt-3 text-sm text-muted">{rewardConfig.deliveryNote}</p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto w-full max-w-3xl px-5 py-16 text-center sm:px-8">
          <h2 className="text-3xl text-navy sm:text-4xl">
            What plan are you finally making happen?
          </h2>
          <div className="mt-7 flex justify-center">
            <Link href="/create" className={primaryButton}>
              Make the plan
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function ExampleInvitationCard() {
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="border-b border-border bg-cream/60 px-6 py-5">
        <p className={eyebrowClass}>Dremmt run</p>
        <h2 className="mt-1 text-2xl text-navy">
          Yohannes wants to go to Esme with you.
        </h2>
      </div>
      <div className="space-y-4 px-6 py-6">
        <p className="text-sm font-semibold text-navy">Pick what works:</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-full border border-border-strong bg-cream px-5 py-3.5 text-navy">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-sky-deep" />
            <span className="font-medium">Tuesday · 12–2 PM</span>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-border-strong bg-cream px-5 py-3.5 text-navy">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-sky-deep" />
            <span className="font-medium">Thursday · 5–7 PM</span>
          </div>
        </div>
        <div className={`${primaryButton} w-full`}>I&apos;m in</div>
        <p className="text-sm text-muted">
          Pick a time and at least $6 toward the outing is locked to that date.
          Go then or miss it—so don&apos;t flake.
        </p>
      </div>
    </article>
  );
}
