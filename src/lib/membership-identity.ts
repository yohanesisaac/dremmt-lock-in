import { isMembershipActive } from "./reward-period";
import type { MemberRow, SubscriptionStatus } from "./types";

/**
 * Pure membership-identity helpers for Checkout bypass.
 *
 * Access is determined only by a database member matched on normalized phone.
 * Cookies / browser state are never proof of membership.
 */

export type CheckoutAccessDecision =
  | { kind: "bypass"; member: MemberRow }
  | { kind: "checkout"; member: MemberRow | null }
  | { kind: "deny"; reason: string };

/** Prefer a subscribed member, then one with Stripe IDs, then most recently updated. */
export function pickMemberForPhone(members: MemberRow[]): MemberRow | null {
  if (members.length === 0) return null;

  const rank = (m: MemberRow): number => {
    let score = 0;
    if (isMembershipActive(m)) score += 100;
    if (m.stripe_subscription_id) score += 20;
    if (m.stripe_customer_id) score += 10;
    return score;
  };

  return [...members].sort((a, b) => {
    const scoreDiff = rank(b) - rank(a);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  })[0]!;
}

/**
 * Decide whether Checkout may be bypassed for a phone-matched member.
 * Lookup failures must be passed in as `lookupError` so we fail closed.
 */
export function decideCheckoutAccess(args: {
  lookupError?: string | null;
  member: MemberRow | null;
}): CheckoutAccessDecision {
  if (args.lookupError) {
    return {
      kind: "deny",
      reason: "We couldn't verify membership right now. Please try again.",
    };
  }

  const member = args.member;
  if (!member) {
    return { kind: "checkout", member: null };
  }

  if (isMembershipActive(member)) {
    return { kind: "bypass", member };
  }

  // canceled, incomplete, past_due, unpaid, inactive, etc. → Checkout again.
  return { kind: "checkout", member };
}

/** Cookie member may only be kept when its phone matches the submitted phone. */
export function cookieMatchesSubmittedPhone(
  cookieMember: Pick<MemberRow, "phone"> | null | undefined,
  submittedCanonicalPhone: string,
): boolean {
  if (!cookieMember?.phone) return false;
  const normalized = submittedCanonicalPhone;
  // Lazy import avoided — compare via national digits for legacy cookie rows.
  const cookieDigits = cookieMember.phone.replace(/\D/g, "").slice(-10);
  const submittedDigits = normalized.replace(/\D/g, "").slice(-10);
  return cookieDigits.length === 10 && cookieDigits === submittedDigits;
}

export function isValidAccessStatus(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}

/**
 * Success-page eligibility: a share token alone is not enough. The run must be
 * past payment and its member must currently have valid access — unless the
 * request was just verified through Stripe (handled by the verify route).
 *
 * Behavior-test runs are exempt from the membership check: they intentionally
 * never mark the member active/trialing, but a `ready` behavior-test run should
 * still reach the share screen. Only trusted when behavior-test mode is on.
 */
export function canShowCheckoutSuccess(args: {
  runStatus: string | null | undefined;
  memberStatus: SubscriptionStatus | null | undefined;
  behaviorTest?: boolean;
}): boolean {
  if (!args.runStatus || args.runStatus === "awaiting_payment") return false;
  if (args.behaviorTest) return true;
  if (!args.memberStatus) return false;
  return isValidAccessStatus(args.memberStatus);
}

/** Deliberate email update rule when phone matches but emails differ. */
export function resolveEmailUpdate(args: {
  existingEmail: string | null | undefined;
  submittedEmail: string;
}): { email: string; mismatched: boolean } {
  const existing = (args.existingEmail ?? "").trim().toLowerCase();
  const submitted = args.submittedEmail.trim().toLowerCase();
  const mismatched = Boolean(existing && existing !== submitted);
  return { email: args.submittedEmail.trim(), mismatched };
}
