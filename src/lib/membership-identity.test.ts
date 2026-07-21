import { describe, expect, it } from "vitest";
import {
  canShowCheckoutSuccess,
  cookieMatchesSubmittedPhone,
  decideCheckoutAccess,
  pickMemberForPhone,
  resolveEmailUpdate,
} from "./membership-identity";
import type { MemberRow } from "./types";

function member(partial: Partial<MemberRow> & Pick<MemberRow, "id" | "subscription_status">): MemberRow {
  return {
    first_name: "Test",
    phone: "+13105550199",
    email: "a@example.com",
    sms_consent: true,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    cancel_at_period_end: false,
    cancellation_requested_at: null,
    access_ends_at: null,
    member_access_token: "token",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("decideCheckoutAccess", () => {
  it("1. new phone → Stripe Checkout path", () => {
    expect(decideCheckoutAccess({ member: null })).toEqual({
      kind: "checkout",
      member: null,
    });
  });

  it("2. old cookie is irrelevant — only phone-matched member is considered", () => {
    // Cookie ignored by caller; null phone match still means checkout.
    expect(decideCheckoutAccess({ member: null })).toEqual({
      kind: "checkout",
      member: null,
    });
  });

  it("3. existing trialing member with matching phone → bypass", () => {
    const m = member({ id: "m1", subscription_status: "trialing" });
    expect(decideCheckoutAccess({ member: m })).toEqual({
      kind: "bypass",
      member: m,
    });
  });

  it("4. existing active member with matching phone → bypass", () => {
    const m = member({ id: "m2", subscription_status: "active" });
    expect(decideCheckoutAccess({ member: m })).toEqual({
      kind: "bypass",
      member: m,
    });
  });

  it("5. cookie for a different phone must be ignored by the caller", () => {
    expect(
      cookieMatchesSubmittedPhone(
        { phone: "+13105550000" },
        "+13105550199",
      ),
    ).toBe(false);
    // When ignored, access is decided as if no member:
    expect(decideCheckoutAccess({ member: null }).kind).toBe("checkout");
  });

  it("6. canceled / past_due / incomplete → Checkout not bypassed", () => {
    for (const status of ["canceled", "past_due", "incomplete", "unpaid", "inactive"] as const) {
      const decision = decideCheckoutAccess({
        member: member({ id: `m-${status}`, subscription_status: status }),
      });
      expect(decision.kind).toBe("checkout");
    }
  });

  it("7. failed member lookup → fail closed / deny", () => {
    const decision = decideCheckoutAccess({
      lookupError: "db down",
      member: null,
    });
    expect(decision.kind).toBe("deny");
  });
});

describe("duplicate prevention helpers", () => {
  it("8. same phone different formatting is treated as one identity via candidates/match", () => {
    expect(
      cookieMatchesSubmittedPhone({ phone: "(310) 555-0199" }, "+13105550199"),
    ).toBe(true);
  });

  it("9. pickMemberForPhone prefers subscribed row over inactive duplicates", () => {
    const inactive = member({
      id: "dup-inactive",
      subscription_status: "inactive",
      updated_at: "2026-07-01T00:00:00.000Z",
    });
    const active = member({
      id: "dup-active",
      subscription_status: "active",
      stripe_customer_id: "cus_123",
      stripe_subscription_id: "sub_123",
      updated_at: "2026-06-01T00:00:00.000Z",
    });
    const picked = pickMemberForPhone([inactive, active]);
    expect(picked?.id).toBe("dup-active");
  });
});

describe("email + success eligibility", () => {
  it("reports email mismatch but updates to submitted email", () => {
    const result = resolveEmailUpdate({
      existingEmail: "old@example.com",
      submittedEmail: "new@example.com",
    });
    expect(result.mismatched).toBe(true);
    expect(result.email).toBe("new@example.com");
  });

  it("success page rejects awaiting_payment / inactive tokens", () => {
    expect(
      canShowCheckoutSuccess({
        runStatus: "awaiting_payment",
        memberStatus: "trialing",
      }),
    ).toBe(false);
    expect(
      canShowCheckoutSuccess({
        runStatus: "ready",
        memberStatus: "canceled",
      }),
    ).toBe(false);
    expect(
      canShowCheckoutSuccess({
        runStatus: "ready",
        memberStatus: "trialing",
      }),
    ).toBe(true);
  });
});
