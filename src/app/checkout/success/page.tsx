import Link from "next/link";
import { SiteHeader, SiteFooter, primaryButton, eyebrowClass } from "@/components/ui";
import { PlanCard } from "@/components/PlanCard";
import { ShareActions } from "@/components/ShareActions";
import { getRunByToken } from "@/lib/data";
import { siteUrl } from "@/lib/env";
import { friendShareMessage } from "@/lib/messages";
import type { TimeWindow } from "@/lib/types";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  const run = token ? await getRunByToken(token) : null;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8">
          {error || !run ? (
            <section className="rounded-lg border border-border bg-surface p-7 shadow-[var(--shadow-card)]">
              <h1 className="text-2xl text-navy">We couldn&apos;t confirm that run</h1>
              <p className="mt-3 text-navy">
                If you were charged, your membership is still active — the webhook
                will reconcile it. Try starting your run again, or contact Dremmt
                during the pilot.
              </p>
              <div className="mt-6">
                <Link href="/create" className={primaryButton}>
                  Back to create
                </Link>
              </div>
            </section>
          ) : (
            <ShareView
              inviteUrl={`${siteUrl()}/invite/${run.invite_token}`}
              message={friendShareMessage(run)}
              friendName={run.friend_name}
              restaurantName={run.restaurant_name}
              location={run.location}
              restaurantLink={run.restaurant_link}
              windows={
                run.time_option_two
                  ? [run.time_option_one, run.time_option_two]
                  : [run.time_option_one]
              }
            />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function ShareView({
  inviteUrl,
  message,
  friendName,
  restaurantName,
  location,
  restaurantLink,
  windows,
}: {
  inviteUrl: string;
  message: string;
  friendName: string;
  restaurantName: string;
  location: string | null;
  restaurantLink: string | null;
  windows: TimeWindow[];
}) {
  return (
    <section className="space-y-6">
      <div>
        <p className={eyebrowClass}>Ready to send</p>
        <h1 className="mt-1 text-3xl text-navy">Your Dremmt run is ready.</h1>
        <p className="mt-2 text-navy">
          Send {friendName} the link. They pick a time and lock it in — no account,
          no payment.
        </p>
      </div>

      <PlanCard
        friendName={friendName}
        restaurantName={restaurantName}
        location={location}
        restaurantLink={restaurantLink}
        windows={windows}
      />

      <div className="rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <p className={eyebrowClass}>Suggested message</p>
        <p className="mt-2 text-navy">{message}</p>
      </div>

      <ShareActions url={inviteUrl} message={message} />

      <p className="text-sm text-muted">
        Dremmt won&apos;t text your friend for you — send the link through text,
        Instagram, WhatsApp, or wherever you two talk.
      </p>

      <p className="text-sm text-muted">
        <Link href="/manage-membership" className="underline underline-offset-4">
          Manage or cancel membership
        </Link>
        . Cancel before your free trial ends and you won&apos;t be charged.
      </p>
    </section>
  );
}
