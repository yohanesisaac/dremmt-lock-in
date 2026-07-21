import Link from "next/link";
import { SiteFooter, Logo, primaryButton } from "@/components/ui";
import { TextInitiatorButton } from "@/components/locked/TextInitiatorButton";
import { getRunByToken } from "@/lib/data";
import { buildSmsHref, friendInSmsMessage } from "@/lib/invite-ui";
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
        <p className="mt-3 text-muted">The link may be incomplete.</p>
      </section>,
    );
  }

  if (run.status !== "accepted" && run.status !== "completed") {
    return shell(
      <section className="rounded-lg border border-border bg-surface p-7 shadow-[var(--shadow-card)]">
        <h1 className="text-2xl text-navy">This run isn&apos;t locked yet</h1>
        <div className="mt-6">
          <Link href={`/invite/${token}`} className={primaryButton}>
            Open the invitation
          </Link>
        </div>
      </section>,
    );
  }

  const window = run.selected_time ?? run.time_option_one;
  const acceptedLabel = formatTimeWindow(window);
  const smsMessage = friendInSmsMessage(run.restaurant_name, window);
  const smsHref = buildSmsHref(run.initiator_phone, smsMessage);

  return shell(
    <section className="space-y-8">
      <h1 className="text-4xl text-navy">You&apos;re locked in.</h1>

      <div className="space-y-2">
        <p className="text-3xl font-semibold text-navy">{run.restaurant_name}</p>
        <p className="text-xl text-navy">{acceptedLabel}</p>
        <p className="text-lg font-medium text-navy">At least $6 locked</p>
      </div>

      <div className="space-y-2">
        <p className="text-lg text-navy">
          Go during this window and send one food or table photo.
        </p>
        <p className="text-sm text-muted">
          A Dremmt number starting with 424 will text you on the day. Reply there
          with the photo.
        </p>
      </div>

      <TextInitiatorButton
        initiatorName={run.initiator_name}
        smsHref={smsHref}
      />
    </section>,
  );
}
