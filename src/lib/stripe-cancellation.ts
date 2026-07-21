import type Stripe from "stripe";
import type { SubscriptionStatus } from "./types";
import { isValidAccessStatus } from "./membership-identity";

export function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status | SubscriptionStatus | string,
): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "unpaid":
      return "unpaid";
    case "canceled":
      return "canceled";
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    default:
      return "inactive";
  }
}

export type StripeCancellationInput = {
  cancel_at_period_end: boolean | null | undefined;
  canceled_at: number | null | undefined;
  cancel_at: number | null | undefined;
  status: Stripe.Subscription.Status | SubscriptionStatus | string;
};

export type NormalizedStripeCancellation = {
  /** Raw Stripe boolean — never reinterpreted. */
  rawCancelAtPeriodEnd: boolean;
  /** ISO timestamptz from subscription.canceled_at, or null. */
  cancellationRequestedAt: string | null;
  /** ISO timestamptz from subscription.cancel_at, or null. */
  accessEndsAt: string | null;
  /**
   * True when cancellation is scheduled:
   * cancel_at_period_end === true OR cancel_at is not null.
   */
  cancellationScheduled: boolean;
  /** True only for trialing/active — future access_ends_at does not revoke. */
  accessCurrentlyValid: boolean;
  subscriptionStatus: SubscriptionStatus;
};

/** Convert Stripe Unix seconds to an ISO timestamptz string. */
export function stripeUnixToIso(
  seconds: number | null | undefined,
): string | null {
  if (seconds === null || seconds === undefined) return null;
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

/**
 * Normalize Stripe cancellation fields into separate DB/UI meanings.
 * Do not overload cancel_at_period_end as a general "scheduled" flag.
 */
export function normalizeStripeCancellationState(
  input: StripeCancellationInput,
): NormalizedStripeCancellation {
  const rawCancelAtPeriodEnd = Boolean(input.cancel_at_period_end);
  const cancellationRequestedAt = stripeUnixToIso(input.canceled_at);
  const accessEndsAt = stripeUnixToIso(input.cancel_at);
  const cancellationScheduled =
    rawCancelAtPeriodEnd === true || accessEndsAt !== null;

  const subscriptionStatus = mapStripeSubscriptionStatus(input.status);

  // Access is based on status only — a future access_ends_at does not revoke.
  const accessCurrentlyValid = isValidAccessStatus(subscriptionStatus);

  return {
    rawCancelAtPeriodEnd,
    cancellationRequestedAt,
    accessEndsAt,
    cancellationScheduled,
    accessCurrentlyValid,
    subscriptionStatus,
  };
}

/** Concise UI label for a scheduled cancellation. Never says "Canceled" while active. */
export function formatCancellationLabel(args: {
  subscriptionStatus: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  accessEndsAt: string | null | undefined;
}): string | null {
  // While still trialing/active (or past_due), show scheduled cancel copy only.
  if (args.accessEndsAt) {
    const date = new Date(args.accessEndsAt);
    if (!Number.isNaN(date.getTime())) {
      const formatted = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      // Do not show "Canceled" for active/trialing — this is "Cancels [date]".
      if (
        args.subscriptionStatus === "trialing" ||
        args.subscriptionStatus === "active" ||
        args.subscriptionStatus === "past_due"
      ) {
        return `Cancels ${formatted}`;
      }
      // After ended, still useful in admin history.
      return `Cancels ${formatted}`;
    }
  }

  if (args.cancelAtPeriodEnd) {
    return "Cancels at the end of the current billing period";
  }

  return null;
}
