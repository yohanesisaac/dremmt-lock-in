import Image from "next/image";
import Link from "next/link";

/* Shared class strings so buttons, cards, and fields stay consistent. */

export const primaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-navy px-6 py-3 text-base font-medium text-cream transition-colors hover:bg-navy-soft disabled:cursor-not-allowed disabled:opacity-60";

export const accentButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-orange px-6 py-3 text-base font-medium text-white transition-colors hover:bg-orange-deep disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border-strong bg-surface px-6 py-3 text-base font-medium text-navy transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-60";

export const ghostButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-base font-medium text-navy underline-offset-4 transition-colors hover:underline";

export const surfaceCard =
  "rounded-lg border border-border bg-surface shadow-[var(--shadow-card)]";

export const inputClass =
  "w-full rounded-md border border-border-strong bg-surface px-4 py-3 text-base text-navy placeholder:text-muted focus:border-orange focus:outline-none";

export const labelClass = "block text-sm font-semibold text-navy";

export const hintClass = "text-sm text-muted";

export const errorTextClass = "text-sm font-medium text-orange-deep";

export const eyebrowClass =
  "text-xs font-semibold uppercase tracking-[0.18em] text-muted";

export function Logo({
  className = "",
  showCity = true,
}: {
  className?: string;
  showCity?: boolean;
}) {
  return (
    <span className={`inline-flex flex-col items-start gap-0.5 ${className}`}>
      <Image
        src="/brand/dremmt-logo.svg"
        alt="Dremmt"
        width={124}
        height={34}
        priority
      />
      {showCity ? (
        <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-navy">
          Culver City
        </span>
      ) : null}
    </span>
  );
}

export function SiteHeader({
  showNav = false,
}: {
  showNav?: boolean;
}) {
  return (
    <header className="border-b border-border bg-cream/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" aria-label="Dremmt home" className="shrink-0">
          <Logo />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          {showNav ? (
            <>
              <a
                href="#how-it-works"
                className="hidden rounded-full px-3 py-2 text-base font-medium text-navy hover:underline sm:inline-flex"
              >
                How it works
              </a>
              <a
                href="#why-10"
                className="hidden rounded-full px-3 py-2 text-base font-medium text-navy hover:underline sm:inline-flex"
              >
                Why $10?
              </a>
            </>
          ) : null}
          <Link href="/create" className={primaryButton}>
            Start free trial
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>Dremmt Lock-In · Pilot</p>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/manage-membership" className="hover:underline">
            Manage or cancel membership
          </Link>
          <a
            href="mailto:dremmtservice@gmail.com?subject=Dremmt%20support&body=Hi%20Dremmt%2C%0A%0AI%20need%20help%20with%3A%20"
            className="hover:underline"
            aria-label="Email Dremmt support"
          >
            Help
          </a>
          <Link href="/privacy" className="hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="hover:underline">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
