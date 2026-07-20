import Link from "next/link";
import { SiteFooter, Logo, primaryButton, eyebrowClass } from "@/components/ui";
import { getRunByToken } from "@/lib/data";
import { rewardConfig } from "@/config/reward";
import { formatTimeWindow } from "@/lib/time-windows";

export default async function LockedPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const run = await getRunByToken(token);

  const shell = (body: React.ReactNode) => (
    <>
      <header className="border-b border-border bg-cream">
        <div className="mx-auto w-full max-w-2xl px-5 py-4 sm:px-8">
          <Logo />
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8">{body}</div>
      </main>
      <SiteFooter />
    </>
  );

  if (!run) {
    return shell(
      <section className="rounded-lg border border-border bg-surface p-7 shadow-[var(--shadow-card)]">
        <h1 className="text-2xl text-navy">We couldn&apos;t find that run</h1>
        <p className="mt-3 text-navy">The link may be incomplete.</p>
      </section>,
    );
  }

  if (run.status !== "accepted" && run.status !== "completed") {
    return shell(
      <section className="rounded-lg border border-border bg-surface p-7 shadow-[var(--shadow-card)]">
        <h1 className="text-2xl text-navy">This run isn&apos;t locked yet</h1>
        <p className="mt-3 text-navy">
          It still needs a time picked. Open the invitation to lock it in.
        </p>
        <div className="mt-6">
          <Link href={`/invite/${token}`} className={primaryButton}>
            Open the invitation
          </Link>
        </div>
      </section>,
    );
  }

  const window = run.selected_time ?? run.time_option_one;

  return shell(
    <section className="space-y-6">
      <div>
        <p className={eyebrowClass}>Locked in</p>
        <h1 className="mt-1 text-4xl text-navy">Run locked.</h1>
      </div>

      <div className="rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
        <p className="text-lg font-semibold text-navy">
          {run.initiator_name} &amp; {run.friend_name}
        </p>
        <dl className="mt-4 space-y-3">
          <div>
            <dt className={eyebrowClass}>Where</dt>
            <dd className="text-lg text-navy">{run.restaurant_name}</dd>
            {run.location ? <dd className="text-muted">{run.location}</dd> : null}
          </div>
          <div>
            <dt className={eyebrowClass}>When</dt>
            <dd className="text-lg text-navy">{formatTimeWindow(window)}</dd>
          </div>
        </dl>
        {run.restaurant_link ? (
          <a
            href={run.restaurant_link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm font-medium text-orange-deep underline underline-offset-4"
          >
            Open restaurant link
          </a>
        ) : null}
      </div>

      <div className="rounded-lg border border-orange/40 bg-orange/5 p-6">
        <p className={eyebrowClass}>{rewardConfig.title}</p>
        <h2 className="mt-1 text-2xl text-navy">{rewardConfig.photoHeading}</h2>
        <p className="mt-2 text-navy">{rewardConfig.photoDescription}</p>
        <p className="mt-1 text-sm text-muted">{rewardConfig.photoNote}</p>
        <p className="mt-3 text-sm text-muted">{rewardConfig.deliveryNote}</p>
      </div>

      <p className="text-sm text-muted">
        Dremmt does not hold a reservation at the restaurant. Make a separate
        reservation if the spot needs one.
      </p>
    </section>,
  );
}
