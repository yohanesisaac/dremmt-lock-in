import { redirect } from "next/navigation";
import { SiteFooter, Logo, eyebrowClass } from "@/components/ui";
import { InviteForm } from "@/components/invite/InviteForm";
import { getRunByToken } from "@/lib/data";
import { formatTimeWindowShort } from "@/lib/time-windows";

function StatusShell({
  heading,
  children,
}: {
  heading: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-border bg-cream">
        <div className="mx-auto w-full max-w-2xl px-5 py-4 sm:px-8">
          <Logo />
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-5 py-12 sm:px-8">
          <section className="rounded-lg border border-border bg-surface p-7 shadow-[var(--shadow-card)]">
            <h1 className="text-2xl text-navy">{heading}</h1>
            {children}
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const run = await getRunByToken(token);

  if (!run) {
    return (
      <StatusShell heading="This invitation could not be found">
        <p className="mt-3 text-navy">
          The link may be incomplete. Ask your friend to send it again.
        </p>
      </StatusShell>
    );
  }

  if (run.status === "accepted" || run.status === "completed") {
    redirect(`/locked/${token}`);
  }

  if (run.status === "time_conflict") {
    return (
      <StatusShell heading="No worries.">
        <p className="mt-3 text-navy">
          We&apos;ll let {run.initiator_name} know those times didn&apos;t work.
          They can send a new plan when it suits you both.
        </p>
      </StatusShell>
    );
  }

  if (run.status === "cancelled" || run.status === "awaiting_payment") {
    return (
      <StatusShell heading="This plan isn't active">
        <p className="mt-3 text-navy">
          Reach out to {run.initiator_name} to get a fresh Dremmt invite.
        </p>
      </StatusShell>
    );
  }

  const options = [
    { value: 1 as const, label: formatTimeWindowShort(run.time_option_one) },
    ...(run.time_option_two
      ? [{ value: 2 as const, label: formatTimeWindowShort(run.time_option_two) }]
      : []),
  ];

  return (
    <>
      <header className="border-b border-border bg-cream">
        <div className="mx-auto w-full max-w-2xl px-5 py-4 sm:px-8">
          <Logo />
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl space-y-6 px-5 py-10 sm:px-8">
          <div>
            <p className={eyebrowClass}>You&apos;re invited</p>
            <h1 className="mt-2 text-3xl text-navy sm:text-4xl">
              {run.initiator_name} wants to go to {run.restaurant_name} with
              you.
            </h1>
          </div>

          <div className="rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
            <p className="text-2xl font-semibold text-navy">
              {run.restaurant_name}
            </p>
            {run.location ? (
              <p className="mt-1 text-muted">{run.location}</p>
            ) : null}
            {run.restaurant_link ? (
              <a
                href={run.restaurant_link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm font-medium text-orange-deep underline underline-offset-4"
              >
                View restaurant link
              </a>
            ) : null}
            {run.personal_message ? (
              <blockquote className="mt-4 rounded-md border-l-2 border-orange bg-cream/70 px-4 py-3 text-navy">
                “{run.personal_message}”
              </blockquote>
            ) : null}
          </div>

          <InviteForm token={token} options={options} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
