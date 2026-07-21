import { rewardConfig } from "@/config/reward";
import { getSupabaseAdmin } from "./supabase";
import type { MemberRow } from "./types";

export function isMembershipActive(
  member: Pick<MemberRow, "subscription_status">,
): boolean {
  return (
    member.subscription_status === "active" ||
    member.subscription_status === "trialing"
  );
}

/** True while the member is inside their 14-day Stripe trial. */
export function isTrialing(
  member: Pick<MemberRow, "subscription_status">,
): boolean {
  return member.subscription_status === "trialing";
}

/** [start, end) of the current calendar month, in UTC. */
export function currentMonthRange(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

/** The first day of next month — when the monthly plan allowance resets. */
export function nextResetDate(now: Date = new Date()): Date {
  return currentMonthRange(now).end;
}

export function formatResetDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export interface MonthlyAllowance {
  used: number;
  remaining: number;
  limit: number;
  limitReached: boolean;
  resetDate: Date;
  /** True when this allowance reflects the trial (one plan total), not a month. */
  isTrial: boolean;
}

/**
 * A member's completed-plan allowance for the current calendar month.
 *
 * Only ACCEPTED plans whose reward was reserved or sent count toward the
 * limit. Trial rewards (`is_trial_reward`) are excluded so they never reduce
 * the paid monthly allowance. Declines and admin-released rewards never count.
 */
export async function getMonthlyAllowance(
  memberId: string,
  now: Date = new Date(),
): Promise<MonthlyAllowance> {
  const { start, end } = currentMonthRange(now);
  const supabase = getSupabaseAdmin();

  const { count, error } = await supabase
    .from("runs")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .in("reward_status", ["reserved", "sent"])
    .eq("is_trial_reward", false)
    .gte("accepted_at", start.toISOString())
    .lt("accepted_at", end.toISOString());

  if (error) {
    throw new Error(`Could not check the monthly plan allowance: ${error.message}`);
  }

  const used = count ?? 0;
  const limit = rewardConfig.monthlyPlanLimit;
  return {
    used,
    remaining: Math.max(0, limit - used),
    limit,
    limitReached: used >= limit,
    resetDate: nextResetDate(now),
    isTrial: false,
  };
}

/**
 * The trial allowance: exactly one rewarded plan for the whole trial. Counts
 * every reserved/sent reward the member has ever activated (a trial member has
 * no prior history, so this is 0 or 1 in practice). Declined invitations and
 * time conflicts never reach a reserved/sent state, so they never count.
 */
export async function getTrialAllowance(
  memberId: string,
  now: Date = new Date(),
): Promise<MonthlyAllowance> {
  const supabase = getSupabaseAdmin();

  const { count, error } = await supabase
    .from("runs")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .in("reward_status", ["reserved", "sent"]);

  if (error) {
    throw new Error(`Could not check the trial plan allowance: ${error.message}`);
  }

  const used = count ?? 0;
  const limit = rewardConfig.trialPlanLimit;
  return {
    used,
    remaining: Math.max(0, limit - used),
    limit,
    limitReached: used >= limit,
    resetDate: nextResetDate(now),
    isTrial: true,
  };
}

/**
 * The plan allowance appropriate for a member's current subscription state:
 * one plan total while trialing, three per calendar month once active.
 */
export async function getMemberAllowance(
  member: Pick<MemberRow, "id" | "subscription_status">,
  now: Date = new Date(),
): Promise<MonthlyAllowance> {
  if (isTrialing(member)) {
    return getTrialAllowance(member.id, now);
  }
  return getMonthlyAllowance(member.id, now);
}

/**
 * Atomically reserves this member's reward for a run they just accepted, but
 * only if they are still under their allowance. Backed by the
 * `reserve_reward` Postgres function so two invitations accepted at the same
 * instant can never both slip past the limit.
 *
 * During the trial the limit is one rewarded plan for the whole trial; once
 * active it is three rewarded plans per calendar month. Trial reservations are
 * marked `is_trial_reward` so they do not reduce the later paid allowance.
 */
export async function reserveReward(
  runId: string,
  memberId: string,
  trialing: boolean,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("reserve_reward", {
    p_run_id: runId,
    p_member_id: memberId,
    p_limit: trialing
      ? rewardConfig.trialPlanLimit
      : rewardConfig.monthlyPlanLimit,
    p_trial: trialing,
  });

  if (error) {
    console.error("reserve_reward failed:", error.message);
    return false;
  }

  return data === true;
}
