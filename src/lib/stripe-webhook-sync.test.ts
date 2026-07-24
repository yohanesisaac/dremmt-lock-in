import { describe, expect, it, vi } from "vitest";
import type { MemberRow } from "./types";
import {
  buildSubscriptionSyncPatch,
  cancellationFieldsMatch,
  findMemberForSubscription,
  syncSubscriptionCancellation,
} from "./stripe-webhook-sync";

function member(partial: Partial<MemberRow> & Pick<MemberRow, "id">): MemberRow {
  return {
    first_name: "Test",
    phone: "+13105550199",
    email: "a@example.com",
    sms_consent: true,
    stripe_customer_id: "cus_123",
    stripe_subscription_id: "sub_123",
    subscription_status: "trialing",
    cancel_at_period_end: false,
    cancellation_requested_at: null,
    access_ends_at: null,
    member_access_token: "token",
    is_behavior_test: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

const cancelRequestedAt = Math.floor(Date.parse("2026-07-20T12:00:00.000Z") / 1000);
const accessEndsAt = Math.floor(Date.parse("2026-08-18T12:00:00.000Z") / 1000);

describe("buildSubscriptionSyncPatch", () => {
  it("keeps raw cancel_at_period_end false while setting timestamps", () => {
    const patch = buildSubscriptionSyncPatch({
      id: "sub_123",
      status: "trialing",
      cancel_at_period_end: false,
      canceled_at: cancelRequestedAt,
      cancel_at: accessEndsAt,
      customer: "cus_123",
    });
    expect(patch.cancel_at_period_end).toBe(false);
    expect(patch.cancellation_requested_at).toBe(
      new Date(cancelRequestedAt * 1000).toISOString(),
    );
    expect(patch.access_ends_at).toBe(new Date(accessEndsAt * 1000).toISOString());
    expect(patch.subscription_status).toBe("trialing");
  });

  it("4. cancellation reversal clears timestamps and boolean", () => {
    const patch = buildSubscriptionSyncPatch({
      id: "sub_123",
      status: "trialing",
      cancel_at_period_end: false,
      canceled_at: null,
      cancel_at: null,
      customer: "cus_123",
    });
    expect(patch.cancel_at_period_end).toBe(false);
    expect(patch.cancellation_requested_at).toBeNull();
    expect(patch.access_ends_at).toBeNull();
  });
});

describe("findMemberForSubscription", () => {
  it("8. lookup by subscription ID", async () => {
    const bySub = member({ id: "m-sub" });
    const result = await findMemberForSubscription({
      subscriptionId: "sub_123",
      customerId: "cus_123",
      findBySubscriptionId: async () => bySub,
      findByCustomerId: async () => member({ id: "m-cus" }),
    });
    expect(result).toEqual({ found: true, member: bySub, via: "subscription_id" });
  });

  it("9. fallback lookup by customer ID", async () => {
    const byCustomer = member({
      id: "m-cus",
      stripe_subscription_id: null,
    });
    const result = await findMemberForSubscription({
      subscriptionId: "sub_missing",
      customerId: "cus_123",
      findBySubscriptionId: async () => null,
      findByCustomerId: async () => byCustomer,
    });
    expect(result).toEqual({
      found: true,
      member: byCustomer,
      via: "customer_id",
    });
  });
});

describe("syncSubscriptionCancellation", () => {
  it("cancellation scheduled persists timestamps with raw boolean false", async () => {
    const patchExpected = buildSubscriptionSyncPatch({
      id: "sub_123",
      status: "trialing",
      cancel_at_period_end: false,
      canceled_at: cancelRequestedAt,
      cancel_at: accessEndsAt,
      customer: "cus_123",
    });

    const result = await syncSubscriptionCancellation({
      subscription: {
        id: "sub_123",
        status: "trialing",
        cancel_at_period_end: false,
        canceled_at: cancelRequestedAt,
        cancel_at: accessEndsAt,
        customer: "cus_123",
      },
      findBySubscriptionId: async () => member({ id: "m1" }),
      findByCustomerId: async () => null,
      updateMemberById: async (id, patch) =>
        member({
          id,
          ...patch,
        }),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.memberId).toBe("m1");
    }
    expect(patchExpected.cancel_at_period_end).toBe(false);
    expect(patchExpected.access_ends_at).not.toBeNull();
  });

  it("4. reversal clears prior timestamps", async () => {
    let written: SubscriptionSyncPatchLike | null = null;
    type SubscriptionSyncPatchLike = {
      cancel_at_period_end: boolean;
      cancellation_requested_at: string | null;
      access_ends_at: string | null;
    };

    await syncSubscriptionCancellation({
      subscription: {
        id: "sub_123",
        status: "trialing",
        cancel_at_period_end: false,
        canceled_at: null,
        cancel_at: null,
        customer: "cus_123",
      },
      findBySubscriptionId: async () =>
        member({
          id: "m1",
          cancel_at_period_end: false,
          cancellation_requested_at: "2026-07-20T12:00:00.000Z",
          access_ends_at: "2026-08-18T12:00:00.000Z",
        }),
      findByCustomerId: async () => null,
      updateMemberById: async (id, patch) => {
        written = patch;
        return member({ id, ...patch });
      },
    });

    expect(written).toMatchObject({
      cancel_at_period_end: false,
      cancellation_requested_at: null,
      access_ends_at: null,
    });
  });

  it("10. no matching member returns failure (HTTP 500 upstream)", async () => {
    const warn = vi.fn();
    const result = await syncSubscriptionCancellation({
      subscription: {
        id: "sub_orphan",
        status: "active",
        cancel_at_period_end: false,
        canceled_at: cancelRequestedAt,
        cancel_at: accessEndsAt,
        customer: "cus_orphan",
      },
      findBySubscriptionId: async () => null,
      findByCustomerId: async () => null,
      updateMemberById: async () => null,
      logWarning: warn,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.outcome).toBe("not_found");
    expect(warn).toHaveBeenCalled();
  });

  it("11. database update failure returns failure", async () => {
    const result = await syncSubscriptionCancellation({
      subscription: {
        id: "sub_123",
        status: "trialing",
        cancel_at_period_end: true,
        canceled_at: cancelRequestedAt,
        cancel_at: null,
        customer: "cus_123",
      },
      findBySubscriptionId: async () => member({ id: "m1" }),
      findByCustomerId: async () => null,
      updateMemberById: async () => {
        throw new Error("db down");
      },
    });
    expect(result).toMatchObject({ ok: false, outcome: "update_failed" });
  });

  it("12. zero-row update returns failure", async () => {
    const result = await syncSubscriptionCancellation({
      subscription: {
        id: "sub_123",
        status: "trialing",
        cancel_at_period_end: true,
        canceled_at: cancelRequestedAt,
        cancel_at: null,
        customer: "cus_123",
      },
      findBySubscriptionId: async () => member({ id: "m1" }),
      findByCustomerId: async () => null,
      updateMemberById: async () => null,
    });
    expect(result).toMatchObject({ ok: false, outcome: "update_failed" });
  });

  it("13. read-back mismatch returns failure", async () => {
    const result = await syncSubscriptionCancellation({
      subscription: {
        id: "sub_123",
        status: "trialing",
        cancel_at_period_end: false,
        canceled_at: cancelRequestedAt,
        cancel_at: accessEndsAt,
        customer: "cus_123",
      },
      findBySubscriptionId: async () => member({ id: "m1" }),
      findByCustomerId: async () => null,
      updateMemberById: async (id) =>
        member({
          id,
          // Stale / wrong stored values
          cancel_at_period_end: false,
          cancellation_requested_at: null,
          access_ends_at: null,
        }),
    });
    expect(result).toMatchObject({ ok: false, outcome: "readback_mismatch" });
  });

  it("14. duplicate webhook delivery is idempotent", async () => {
    const update = vi.fn(async (id: string, patch: Parameters<
      typeof syncSubscriptionCancellation
    >[0]["updateMemberById"] extends (
      id: string,
      patch: infer P,
    ) => unknown
      ? P
      : never) => member({ id, ...patch }));

    const subscription = {
      id: "sub_123",
      status: "trialing" as const,
      cancel_at_period_end: false,
      canceled_at: cancelRequestedAt,
      cancel_at: accessEndsAt,
      customer: "cus_123",
    };

    const first = await syncSubscriptionCancellation({
      subscription,
      findBySubscriptionId: async () => member({ id: "m1" }),
      findByCustomerId: async () => null,
      updateMemberById: update,
    });
    const second = await syncSubscriptionCancellation({
      subscription,
      findBySubscriptionId: async () => member({ id: "m1" }),
      findByCustomerId: async () => null,
      updateMemberById: update,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("7. deleted subscription marks status canceled and keeps timestamps", async () => {
    let written: ReturnType<typeof buildSubscriptionSyncPatch> | null = null;
    const result = await syncSubscriptionCancellation({
      subscription: {
        id: "sub_123",
        status: "canceled",
        cancel_at_period_end: false,
        canceled_at: cancelRequestedAt,
        cancel_at: accessEndsAt,
        customer: "cus_123",
      },
      asDeleted: true,
      findBySubscriptionId: async () => member({ id: "m1" }),
      findByCustomerId: async () => null,
      updateMemberById: async (id, patch) => {
        written = patch;
        return member({ id, ...patch });
      },
    });
    expect(result.ok).toBe(true);
    expect(written?.subscription_status).toBe("canceled");
    expect(written?.access_ends_at).not.toBeNull();
    expect(written?.cancellation_requested_at).not.toBeNull();
  });
});

describe("cancellationFieldsMatch / invoice safety", () => {
  it("15. invoice-style status-only change does not require wiping cancel fields", () => {
    const stored = member({
      id: "m1",
      subscription_status: "past_due",
      cancel_at_period_end: false,
      cancellation_requested_at: "2026-07-20T12:00:00.000Z",
      access_ends_at: "2026-08-18T12:00:00.000Z",
    });
    const patch = buildSubscriptionSyncPatch({
      id: "sub_123",
      status: "past_due",
      cancel_at_period_end: false,
      canceled_at: cancelRequestedAt,
      cancel_at: accessEndsAt,
      customer: "cus_123",
    });
    expect(cancellationFieldsMatch(stored, patch)).toBe(true);
  });
});
