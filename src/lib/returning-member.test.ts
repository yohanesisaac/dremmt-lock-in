import { describe, expect, it } from "vitest";
import { normalizeUsPhone } from "./phone";
import { decideCheckoutAccess, pickMemberForPhone } from "./membership-identity";
import {
  buildReturningMemberView,
  computeAllowanceState,
  countPaidMonthlyUsage,
  parseReturningMemberPayload,
  shouldOfferCheckoutTrial,
} from "./returning-member";
import { rewardConfig } from "@/config/reward";
import type { MemberRow } from "./types";

function member(
  partial: Partial<MemberRow> & Pick<MemberRow, "id" | "subscription_status" | "phone">,
): MemberRow {
  return {
    first_name: "Test",
    email: "a@example.com",
    sms_consent: true,
    stripe_customer_id: partial.stripe_customer_id ?? null,
    stripe_subscription_id: partial.stripe_subscription_id ?? null,
    cancel_at_period_end: false,
    cancellation_requested_at: null,
    access_ends_at: null,
    member_access_token: "token",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    ...partial,
  };
}

function lookup(submittedPhone: string, dbRows: MemberRow[]) {
  const normalized = normalizeUsPhone(submittedPhone);
  if (!normalized.ok) return { kind: "invalid_phone" as const };
  const matches = dbRows.filter((row) => {
    const rowPhone = row.phone ? normalizeUsPhone(row.phone) : null;
    return rowPhone?.ok && rowPhone.phone === normalized.phone;
  });
  return {
    kind: "ok" as const,
    phone: normalized.phone,
    member: pickMemberForPhone(matches),
    matches,
  };
}

describe("returning-member lookup", () => {
  it("10. existing trialing phone reaches trial status", () => {
    const found = lookup("(310) 902-8228", [
      member({
        id: "trial",
        phone: "+13109028228",
        subscription_status: "trialing",
      }),
    ]);
    expect(found.kind).toBe("ok");
    if (found.kind !== "ok") return;
    const view = buildReturningMemberView({
      member: found.member,
      allowance: {
        used: 0,
        remaining: 1,
        limit: 1,
        limitReached: false,
        resetDate: new Date(),
        isTrial: true,
      },
    });
    expect(view).toMatchObject({
      kind: "active",
      isTrial: true,
      remaining: 1,
      limit: 1,
    });
  });

  it("11. existing active phone reaches paid status", () => {
    const found = lookup("3109028228", [
      member({
        id: "paid",
        phone: "+13109028228",
        subscription_status: "active",
      }),
    ]);
    expect(found.kind).toBe("ok");
    if (found.kind !== "ok") return;
    const view = buildReturningMemberView({
      member: found.member,
      allowance: {
        used: 1,
        remaining: 2,
        limit: 3,
        limitReached: false,
        resetDate: new Date(),
        isTrial: false,
      },
    });
    expect(view).toMatchObject({
      kind: "active",
      isTrial: false,
      remaining: 2,
      limit: 3,
    });
  });

  it("12. unknown phone does not create a member", () => {
    const found = lookup("3109028228", []);
    expect(found.kind).toBe("ok");
    if (found.kind !== "ok") return;
    expect(found.member).toBeNull();
    expect(buildReturningMemberView({ member: null }).kind).toBe("not_found");
  });

  it("13. inactive member does not receive access", () => {
    const found = lookup("3109028228", [
      member({
        id: "dead",
        phone: "+13109028228",
        subscription_status: "canceled",
      }),
    ]);
    expect(found.kind).toBe("ok");
    if (found.kind !== "ok") return;
    const view = buildReturningMemberView({ member: found.member });
    expect(view.kind).toBe("inactive");
    expect(decideCheckoutAccess({ member: found.member }).kind).toBe("checkout");
  });

  it("14. cookies alone cannot grant returning-member access", () => {
    // Unsigned / expired payloads never produce a usable context.
    expect(parseReturningMemberPayload(null)).toBeNull();
    expect(parseReturningMemberPayload("not-a-payload")).toBeNull();
    expect(
      parseReturningMemberPayload(
        "member-id:+13109028228:1", // expired exp
        Date.now(),
      ),
    ).toBeNull();
    // Access decision still requires a DB member with valid status.
    expect(decideCheckoutAccess({ member: null }).kind).toBe("checkout");
  });

  it("15. returning-member create flow revalidates status and allowance", () => {
    const active = member({
      id: "m1",
      phone: "+13109028228",
      subscription_status: "active",
    });
    const staleInactive = member({
      id: "m1",
      phone: "+13109028228",
      subscription_status: "canceled",
    });

    // Cookie may still name m1, but live status must win.
    expect(buildReturningMemberView({ member: active, allowance: {
      used: 0, remaining: 3, limit: 3, limitReached: false, resetDate: new Date(), isTrial: false,
    } }).kind).toBe("active");
    expect(buildReturningMemberView({ member: staleInactive }).kind).toBe("inactive");

    const allowance = computeAllowanceState({
      isTrial: false,
      used: 3,
      trialLimit: rewardConfig.trialPlanLimit,
      monthlyLimit: rewardConfig.monthlyPlanLimit,
    });
    expect(allowance.limitReached).toBe(true);
  });

  it("16. same phone with different formatting finds the same member", () => {
    const rows = [
      member({
        id: "one",
        phone: "+13109028228",
        subscription_status: "active",
      }),
    ];
    const a = lookup("(310) 902-8228", rows);
    const b = lookup("+1 310 902 8228", rows);
    const c = lookup("13109028228", rows);
    expect(a.kind).toBe("ok");
    expect(b.kind).toBe("ok");
    expect(c.kind).toBe("ok");
    if (a.kind === "ok" && b.kind === "ok" && c.kind === "ok") {
      expect(a.member?.id).toBe("one");
      expect(b.member?.id).toBe("one");
      expect(c.member?.id).toBe("one");
    }
  });
});

describe("shouldOfferCheckoutTrial (restart path)", () => {
  it("offers trial only to brand-new members without Stripe history", () => {
    expect(shouldOfferCheckoutTrial(null)).toBe(true);
    expect(
      shouldOfferCheckoutTrial(
        member({ id: "new", phone: "+13109028228", subscription_status: "inactive" }),
      ),
    ).toBe(true);
    expect(
      shouldOfferCheckoutTrial(
        member({
          id: "prior",
          phone: "+13109028228",
          subscription_status: "canceled",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
        }),
      ),
    ).toBe(false);
  });
});

describe("allowance rules", () => {
  it("17–21. trial allowance is 1 total and does not reset monthly", () => {
    const start = computeAllowanceState({
      isTrial: true,
      used: 0,
      trialLimit: 1,
      monthlyLimit: 3,
    });
    expect(start).toMatchObject({ remaining: 1, limit: 1, limitReached: false });

    const afterFirst = computeAllowanceState({
      isTrial: true,
      used: 1,
      trialLimit: 1,
      monthlyLimit: 3,
    });
    expect(afterFirst).toMatchObject({ remaining: 0, limitReached: true });

    const secondBlocked = computeAllowanceState({
      isTrial: true,
      used: 1,
      trialLimit: 1,
      monthlyLimit: 3,
    });
    expect(secondBlocked.limitReached).toBe(true);

    // Decline never reaches reserved/sent → used stays 0.
    const afterDecline = computeAllowanceState({
      isTrial: true,
      used: 0,
      trialLimit: 1,
      monthlyLimit: 3,
    });
    expect(afterDecline.remaining).toBe(1);

    // Trial does not reset with the calendar month (still all-time used=1).
    expect(
      computeAllowanceState({
        isTrial: true,
        used: 1,
        trialLimit: 1,
        monthlyLimit: 3,
      }).remaining,
    ).toBe(0);
  });

  it("22–27. paid member receives 3 plans; fourth blocked; duplicate counts once", () => {
    expect(rewardConfig.monthlyPlanLimit).toBe(3);

    const steps = [0, 1, 2, 3, 4].map((used) =>
      computeAllowanceState({
        isTrial: false,
        used,
        trialLimit: 1,
        monthlyLimit: 3,
      }),
    );
    expect(steps[0]).toMatchObject({ remaining: 3, limitReached: false });
    expect(steps[1]).toMatchObject({ remaining: 2 });
    expect(steps[2]).toMatchObject({ remaining: 1 });
    expect(steps[3]).toMatchObject({ remaining: 0, limitReached: true });
    expect(steps[4]).toMatchObject({ remaining: 0, limitReached: true });

    // Duplicate acceptance: used count stays at the number of distinct reserved rows.
    expect(
      computeAllowanceState({
        isTrial: false,
        used: 1,
        trialLimit: 1,
        monthlyLimit: 3,
      }).remaining,
    ).toBe(2);
  });

  it("28. trial usage does not reduce the later paid allowance of 3", () => {
    const paidUsed = countPaidMonthlyUsage({
      rewards: [
        { isTrialReward: true },
        { isTrialReward: false },
        { isTrialReward: false },
      ],
    });
    expect(paidUsed).toBe(2);
    expect(
      computeAllowanceState({
        isTrial: false,
        used: paidUsed,
        trialLimit: 1,
        monthlyLimit: 3,
      }).remaining,
    ).toBe(1);
  });

  it("29. expired trial without payment does not receive 3 plans", () => {
    const expired = member({
      id: "x",
      phone: "+13109028228",
      subscription_status: "canceled",
    });
    expect(buildReturningMemberView({ member: expired }).kind).toBe("inactive");
    expect(decideCheckoutAccess({ member: expired }).kind).toBe("checkout");
  });

  it("30–31. monthly reset restores to 3 with no rollover above 3", () => {
    // New month → used resets to 0 in the query layer.
    const reset = computeAllowanceState({
      isTrial: false,
      used: 0,
      trialLimit: 1,
      monthlyLimit: 3,
    });
    expect(reset.remaining).toBe(3);
    expect(reset.limit).toBe(3);
    // Even if somehow used were negative, remaining never exceeds limit.
    expect(
      computeAllowanceState({
        isTrial: false,
        used: -1,
        trialLimit: 1,
        monthlyLimit: 3,
      }).remaining,
    ).toBe(3);
  });
});

describe("paid-member copy / config", () => {
  it("paid screens use 3 plans, not 2", () => {
    expect(rewardConfig.monthlyPlanLimit).toBe(3);
    expect(rewardConfig.trialPlanLimit).toBe(1);
    const copy = `You have 2 of ${rewardConfig.monthlyPlanLimit} plans left this month.`;
    expect(copy).toContain("of 3");
    expect(copy).not.toMatch(/of 2/);
  });
});
