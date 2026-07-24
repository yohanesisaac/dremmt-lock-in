import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter, Logo } from "@/components/ui";
import { InviteForm } from "@/components/invite/InviteForm";
import { getRunByToken } from "@/lib/data";
import { shouldRedirectInviteToLocked } from "@/lib/invite-ui";
import { formatTimeWindowShort } from "@/lib/time-windows";
import { buildInvitePreview } from "@/lib/invite-preview";
import { buildInviteShareUrl, resolveServerSiteUrl } from "@/lib/env";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const run = await getRunByToken(token);
  const preview = buildInvitePreview(run);

  // metadataBase lets the file-based opengraph-image/twitter-image resolve to
  // absolute URLs. Falls back gracefully when no public origin is configured.
  let metadataBase: URL | undefined;
  let inviteUrl: string | undefined;
  try {
    const origin = await resolveServerSiteUrl();
    metadataBase = new URL(origin);
    inviteUrl = buildInviteShareUrl(origin, token);
  } catch {
    metadataBase = undefined;
  }

  return {
    ...(metadataBase ? { metadataBase } : {}),
    title: preview.metaTitle,
    description: preview.metaDescription,
    openGraph: {
      type: "website",
      siteName: "Dremmt",
      title: preview.metaTitle,
      description: preview.metaDescription,
      ...(inviteUrl ? { url: inviteUrl } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: preview.metaTitle,
      description: preview.metaDescription,
    },
  };
}

function StatusShell({
  heading,
  children,
}: {
  heading: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-border bg-cream/90 backdrop-blur">
        <div className="mx-auto w-full max-w-md px-5 py-4 sm:px-8">
          <Logo />
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-md px-5 py-12 sm:px-8 sm:py-16">
          <section className="overflow-hidden rounded-lg border border-border bg-surface p-7 shadow-[var(--shadow-card)]">
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
        <p className="mt-3 text-navy">Ask your friend to send the link again.</p>
      </StatusShell>
    );
  }

  if (shouldRedirectInviteToLocked(run.status)) {
    redirect(`/locked/${token}`);
  }

  if (run.status === "time_conflict") {
    return (
      <StatusShell heading="No worries.">
        <p className="mt-3 text-navy">
          We&apos;ll let {run.initiator_name} know those times didn&apos;t work.
        </p>
      </StatusShell>
    );
  }

  if (run.status === "cancelled" || run.status === "awaiting_payment") {
    return (
      <StatusShell heading="This plan isn't active">
        <p className="mt-3 text-navy">
          Reach out to {run.initiator_name} for a fresh invite.
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
      <header className="border-b border-border bg-cream/90 backdrop-blur">
        <div className="mx-auto w-full max-w-md px-5 py-4 sm:px-8">
          <Logo />
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-md px-5 py-12 sm:px-8 sm:py-16">
          <InviteForm
            token={token}
            options={options}
            initiatorName={run.initiator_name}
            restaurantName={run.restaurant_name}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
