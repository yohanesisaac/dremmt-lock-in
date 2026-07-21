import { getReturningMemberFromCookie } from "./auth";
import { formatUsPhoneDisplay } from "./phone";
import {
  getMemberAllowance,
  isMembershipActive,
  isTrialing,
} from "./reward-period";

export type ReturningCreateContext = {
  phoneDisplay: string;
  canonicalPhone: string;
  firstName: string | null;
  email: string | null;
  isTrial: boolean;
  remaining: number;
  limit: number;
  limitReached: boolean;
  hasValidAccess: boolean;
  /** True when membership exists but is not currently trialing/active. */
  isRestart: boolean;
};

/**
 * Revalidate returning-member cookie against live member status + allowance.
 * A stale cookie never preserves access after subscription becomes invalid.
 */
export async function loadReturningCreateContext(): Promise<ReturningCreateContext | null> {
  const loaded = await getReturningMemberFromCookie();
  if (!loaded) return null;

  const { member, context } = loaded;
  const hasValidAccess = isMembershipActive(member);

  if (!hasValidAccess) {
    return {
      phoneDisplay: formatUsPhoneDisplay(context.phone),
      canonicalPhone: context.phone,
      firstName: member.first_name,
      email: member.email,
      isTrial: false,
      remaining: 0,
      limit: 0,
      limitReached: true,
      hasValidAccess: false,
      isRestart: true,
    };
  }

  const allowance = await getMemberAllowance(member);
  return {
    phoneDisplay: formatUsPhoneDisplay(context.phone),
    canonicalPhone: context.phone,
    firstName: member.first_name,
    email: member.email,
    isTrial: isTrialing(member),
    remaining: allowance.remaining,
    limit: allowance.limit,
    limitReached: allowance.limitReached,
    hasValidAccess: true,
    isRestart: false,
  };
}
