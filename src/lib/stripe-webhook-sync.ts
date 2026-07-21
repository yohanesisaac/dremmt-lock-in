import type Stripe from "stripe";
import type { MemberRow } from "./types";
import {
  mapStripeSubscriptionStatus,
  normalizeStripeCancellationState,
} from "./stripe-cancellation";

export { mapStripeSubscriptionStatus };

export function stripeCustomerIdFromSubscription(
  subscription: Pick<Stripe.Subscription, "customer">,
): string | null {
  if (typeof subscription.customer === "string") return subscription.customer;
  if (subscription.customer && typeof subscription.customer === "object") {
    return subscription.customer.id ?? null;
  }
  return null;
}

export interface SubscriptionSyncPatch {
  subscription_status: ReturnType<typeof mapStripeSubscriptionStatus>;
  cancel_at_period_end: boolean;
  cancellation_requested_at: string | null;
  access_ends_at: string | null;
  stripe_subscription_id: string;
  stripe_customer_id: string | null;
}

export type StripeSubscriptionSyncFields = Pick<
  Stripe.Subscription,
  | "id"
  | "status"
  | "cancel_at_period_end"
  | "canceled_at"
  | "cancel_at"
  | "customer"
>;

/** Build the member row patch from a Stripe Subscription object. */
export function buildSubscriptionSyncPatch(
  subscription: StripeSubscriptionSyncFields,
): SubscriptionSyncPatch {
  const normalized = normalizeStripeCancellationState({
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at,
    cancel_at: subscription.cancel_at,
    status: subscription.status,
  });

  return {
    subscription_status: normalized.subscriptionStatus,
    cancel_at_period_end: normalized.rawCancelAtPeriodEnd,
    cancellation_requested_at: normalized.cancellationRequestedAt,
    access_ends_at: normalized.accessEndsAt,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: stripeCustomerIdFromSubscription(subscription),
  };
}

export type MemberLookupResult =
  | { found: true; member: MemberRow; via: "subscription_id" | "customer_id" }
  | { found: false };

/**
 * Locate the member for a Stripe subscription.
 * Primary: stripe_subscription_id. Fallback: stripe_customer_id.
 * Never uses cookie, phone, or email.
 */
export async function findMemberForSubscription(args: {
  subscriptionId: string;
  customerId: string | null;
  findBySubscriptionId: (subscriptionId: string) => Promise<MemberRow | null>;
  findByCustomerId: (customerId: string) => Promise<MemberRow | null>;
}): Promise<MemberLookupResult> {
  const bySub = await args.findBySubscriptionId(args.subscriptionId);
  if (bySub) {
    return { found: true, member: bySub, via: "subscription_id" };
  }

  if (args.customerId) {
    const byCustomer = await args.findByCustomerId(args.customerId);
    if (byCustomer) {
      return { found: true, member: byCustomer, via: "customer_id" };
    }
  }

  return { found: false };
}

export function cancellationFieldsMatch(
  stored: Pick<
    MemberRow,
    | "subscription_status"
    | "cancel_at_period_end"
    | "cancellation_requested_at"
    | "access_ends_at"
    | "stripe_subscription_id"
    | "stripe_customer_id"
  >,
  patch: SubscriptionSyncPatch,
): boolean {
  const sameTime = (a: string | null | undefined, b: string | null | undefined) => {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return new Date(a).getTime() === new Date(b).getTime();
  };

  return (
    stored.subscription_status === patch.subscription_status &&
    stored.cancel_at_period_end === patch.cancel_at_period_end &&
    sameTime(stored.cancellation_requested_at, patch.cancellation_requested_at) &&
    sameTime(stored.access_ends_at, patch.access_ends_at) &&
    stored.stripe_subscription_id === patch.stripe_subscription_id &&
    (patch.stripe_customer_id == null ||
      stored.stripe_customer_id === patch.stripe_customer_id)
  );
}

export type SyncSubscriptionResult =
  | { ok: true; outcome: "updated"; memberId: string; via: "subscription_id" | "customer_id" }
  | { ok: false; error: string; outcome: "not_found" | "update_failed" | "readback_mismatch" };

/**
 * Apply a subscription sync patch to the matching member, then verify read-back.
 * Idempotent: applying the same patch twice succeeds.
 * Returns ok:false (caller should HTTP 500) when no member / update / mismatch.
 */
export async function syncSubscriptionCancellation(args: {
  subscription: StripeSubscriptionSyncFields;
  findBySubscriptionId: (subscriptionId: string) => Promise<MemberRow | null>;
  findByCustomerId: (customerId: string) => Promise<MemberRow | null>;
  updateMemberById: (
    memberId: string,
    patch: SubscriptionSyncPatch,
  ) => Promise<MemberRow | null>;
  logWarning?: (message: string) => void;
  /** When true, force status canceled and do not clear historical cancel timestamps. */
  asDeleted?: boolean;
}): Promise<SyncSubscriptionResult> {
  const patch = buildSubscriptionSyncPatch(args.subscription);

  if (args.asDeleted) {
    patch.subscription_status = "canceled";
    // Preserve cancellation_requested_at / access_ends_at from the payload
    // (or from patch built above). Do not force them to null.
  }

  const lookup = await findMemberForSubscription({
    subscriptionId: args.subscription.id,
    customerId: patch.stripe_customer_id,
    findBySubscriptionId: args.findBySubscriptionId,
    findByCustomerId: args.findByCustomerId,
  });

  if (!lookup.found) {
    const message =
      `[stripe webhook] No member matched subscription ${args.subscription.id}` +
      (patch.stripe_customer_id
        ? ` (customer ${patch.stripe_customer_id})`
        : "");
    args.logWarning?.(message);
    return {
      ok: false,
      outcome: "not_found",
      error: "No matching member for Stripe subscription.",
    };
  }

  let stored: MemberRow | null;
  try {
    stored = await args.updateMemberById(lookup.member.id, patch);
  } catch (err) {
    const error = err instanceof Error ? err.message : "Member update failed.";
    args.logWarning?.(`[stripe webhook] ${error}`);
    return { ok: false, outcome: "update_failed", error };
  }

  if (!stored) {
    const error = `Member update matched zero rows for id ${lookup.member.id}.`;
    args.logWarning?.(`[stripe webhook] ${error}`);
    return { ok: false, outcome: "update_failed", error };
  }

  if (!cancellationFieldsMatch(stored, patch)) {
    const error = `Read-back mismatch for member ${lookup.member.id}.`;
    args.logWarning?.(`[stripe webhook] ${error}`);
    return { ok: false, outcome: "readback_mismatch", error };
  }

  return {
    ok: true,
    outcome: "updated",
    memberId: lookup.member.id,
    via: lookup.via,
  };
}
