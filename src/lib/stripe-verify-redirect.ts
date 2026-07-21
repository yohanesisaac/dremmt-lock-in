/**
 * Pure helpers for post-Checkout verification redirects.
 * Keep redirect construction out of the route so Production origin behavior is testable.
 */

/** Run statuses that may be updated to `ready` after Checkout (includes ready for idempotent reloads). */
export const VERIFY_RUN_READY_STATUSES = ["awaiting_payment", "ready"] as const;

export function buildStripeVerifyRedirect(
  origin: string,
  args: { inviteToken?: string | null; error?: boolean },
): { url: string; pathname: string } {
  const base = origin.replace(/\/$/, "");
  if (args.error || !args.inviteToken) {
    return {
      url: `${base}/checkout/success?error=1`,
      pathname: "/checkout/success",
    };
  }
  return {
    url: `${base}/checkout/success?token=${args.inviteToken}`,
    pathname: "/checkout/success",
  };
}

/** True when a second verify pass should not create new work — only refresh ready state. */
export function isIdempotentVerifyRunStatus(
  status: string | null | undefined,
): boolean {
  return status === "awaiting_payment" || status === "ready";
}
