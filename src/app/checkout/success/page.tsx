import Link from "next/link";
import { SiteHeader, SiteFooter, primaryButton, eyebrowClass } from "@/components/ui";
import { ShareActions } from "@/components/ShareActions";
import { getMemberById, getRunByToken } from "@/lib/data";
import { buildInviteShareUrl, resolveServerSiteUrl } from "@/lib/env";
import { friendShareMessage } from "@/lib/messages";
import { canShowCheckoutSuccess } from "@/lib/membership-identity";
import { getInitiatorShareStatus } from "@/lib/invite-ui";
import { formatTimeWindowShort } from "@/lib/time-windows";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  const run = token ? await getRunByToken(token) : null;
  const member = run?.member_id ? await getMemberById(run.member_id) : null;

  const eligible =
    !error &&
    run &&
    canShowCheckoutSuccess({
      runStatus: run.status,
      memberStatus: member?.subscription_status,
    });

  // Absolute URL only for the copy/share field. In-app Links stay relative
  // (/create, /manage-membership) and do not require a public origin.
  let inviteUrl = "";
  if (eligible && run) {
    try {
      const origin = await resolveServerSiteUrl();
      inviteUrl = buildInviteShareUrl(origin, run.invite_token);
    } catch {
      // Still render the success UI; relative path is same-origin in the browser.
      inviteUrl = `/invite/${run.invite_token}`;
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8">
          {!eligible || !run ? (
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
              inviteUrl={inviteUrl}
              message={friendShareMessage(run)}
              status={getInitiatorShareStatus(run)}
              proposedWindows={
                run.time_option_two
                  ? [
                      formatTimeWindowShort(run.time_option_one),
                      formatTimeWindowShort(run.time_option_two),
                    ]
                  : [formatTimeWindowShort(run.time_option_one)]
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
  status,
  proposedWindows,
}: {
  inviteUrl: string;
  message: string;
  status: ReturnType<typeof getInitiatorShareStatus>;
  proposedWindows: string[];
}) {
  if (status.kind === "conflict") {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl text-navy">Neither time works.</h1>
        <p className="text-muted">
          <Link href="/create" className="underline underline-offset-4">
            Make a new plan
          </Link>
        </p>
      </section>
    );
  }

  if (status.kind === "accepted") {
    return (
      <section className="space-y-6">
        <h1 className="text-3xl text-navy">{status.friendName} is in.</h1>
        <div className="space-y-2">
          <p className="text-2xl font-semibold text-navy">{status.restaurantName}</p>
          <p className="text-xl text-navy">{status.acceptedLabel}</p>
          <p className="text-lg font-medium text-navy">At least $6 locked</p>
        </div>
        <p className="text-sm text-muted">
          <Link href="/manage-membership" className="underline underline-offset-4">
            Manage or cancel membership
          </Link>
        </p>
      </section>
    );
  }

  const friendName =
    status.kind === "waiting" ? status.friendName : "your friend";

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl text-navy">Waiting for {friendName}</h1>
        <ul className="mt-4 space-y-2">
          {proposedWindows.map((label) => (
            <li
              key={label}
              className="rounded-full border border-border-strong bg-cream px-5 py-3 text-navy"
            >
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <p className={eyebrowClass}>Suggested message</p>
        <p className="mt-2 text-navy">{message}</p>
      </div>

      <ShareActions url={inviteUrl} message={message} />

      <p className="text-sm text-muted">
        <Link href="/manage-membership" className="underline underline-offset-4">
          Manage or cancel membership
        </Link>
      </p>
    </section>
  );
}
