import { isMembershipActive, isTrialing, type MonthlyAllowance } from "./reward-period";
import type { MemberRow } from "./types";

/**
 * Returning-member lookup / status helpers.
 *
 * Cookies may remember which member was looked up, but they are never proof of
 * access — the server must re-check phone → member → status → allowance.
 */

export type ReturningMemberContextPayload = {
  memberId: string;
  phone: string;
  exp: number;
};

/** Build the signed cookie payload string (memberId:phone:exp). */
export function serializeReturningMemberPayload(
  memberId: string,
  canonicalPhone: string,
  exp: number,
): string {
  return `${memberId}:${canonicalPhone}:${exp}`;
}

/** Parse a verified (already HMAC-checked) returning-member payload. */
export function parseReturningMemberPayload(
  verified: string | null,
  nowMs: number = Date.now(),
): ReturningMemberContextPayload | null {
  if (!verified) return null;

  const parts = verified.split(":");
  if (parts.length < 3) return null;
  const expRaw = parts[parts.length - 1]!;
  const phone = parts[parts.length - 2]!;
  const memberId = parts.slice(0, -2).join(":");
  const exp = Number(expRaw);
  if (!memberId || !phone || !Number.isFinite(exp) || exp < nowMs) return null;
  if (!phone.startsWith("+1") || phone.length !== 12) return null;

  return { memberId, phone, exp };
}

export type ReturningMemberView =
  | { kind: "not_found" }
  | {
      kind: "inactive";
      memberId: string;
    }
  | {
      kind: "active";
      memberId: string;
      isTrial: boolean;
      used: number;
      remaining: number;
      limit: number;
      limitReached: boolean;
    };

/** Build the UI status for a phone-matched member (no Stripe details). */
export function buildReturningMemberView(args: {
  member: MemberRow | null;
  allowance?: MonthlyAllowance | null;
}): ReturningMemberView {
  const member = args.member;
  if (!member) return { kind: "not_found" };

  if (!isMembershipActive(member)) {
    return { kind: "inactive", memberId: member.id };
  }

  const allowance = args.allowance;
  if (!allowance) {
    return {
      kind: "active",
      memberId: member.id,
      isTrial: isTrialing(member),
      used: 0,
      remaining: 0,
      limit: 0,
      limitReached: true,
    };
  }

  return {
    kind: "active",
    memberId: member.id,
    isTrial: allowance.isTrial,
    used: allowance.used,
    remaining: allowance.remaining,
    limit: allowance.limit,
    limitReached: allowance.limitReached,
  };
}

/**
 * Whether Checkout should attach a 14-day trial.
 *
 * Safest rule for the pilot: only brand-new members with no prior Stripe
 * customer/subscription history get a trial. Anyone restarting after a prior
 * membership (including canceled / past_due) checks out without a second trial.
 */
export function shouldOfferCheckoutTrial(
  member: Pick<
    MemberRow,
    "stripe_customer_id" | "stripe_subscription_id" | "subscription_status"
  > | null,
): boolean {
  if (!member) return true;

  if (member.stripe_customer_id || member.stripe_subscription_id) {
    return false;
  }

  // Prior non-inactive statuses imply a previous membership attempt.
  if (
    member.subscription_status !== "inactive" &&
    member.subscription_status !== "incomplete"
  ) {
    return false;
  }

  return true;
}

/** Pure allowance math used by tests and status copy. */
export function computeAllowanceState(args: {
  isTrial: boolean;
  used: number;
  trialLimit: number;
  monthlyLimit: number;
}): {
  used: number;
  remaining: number;
  limit: number;
  limitReached: boolean;
  isTrial: boolean;
} {
  const limit = args.isTrial ? args.trialLimit : args.monthlyLimit;
  const used = Math.max(0, args.used);
  return {
    used,
    remaining: Math.max(0, limit - used),
    limit,
    limitReached: used >= limit,
    isTrial: args.isTrial,
  };
}

/**
 * Paid monthly used-count excludes trial rewards so a trial plan never reduces
 * the later paid allowance of 3.
 */
export function countPaidMonthlyUsage(args: {
  rewards: Array<{ isTrialReward: boolean }>;
}): number {
  return args.rewards.filter((r) => !r.isTrialReward).length;
}
