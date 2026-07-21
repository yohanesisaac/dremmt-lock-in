import { describe, expect, it } from "vitest";
import {
  formatCancellationLabel,
  normalizeStripeCancellationState,
} from "./stripe-cancellation";

describe("normalizeStripeCancellationState", () => {
  it("1. cancel_at set with cancel_at_period_end false → scheduled, status stays trialing", () => {
    const now = Math.floor(Date.now() / 1000);
    const ends = now + 60 * 60 * 24 * 14;
    const result = normalizeStripeCancellationState({
      status: "trialing",
      cancel_at_period_end: false,
      canceled_at: now,
      cancel_at: ends,
    });

    expect(result.rawCancelAtPeriodEnd).toBe(false);
    expect(result.cancellationRequestedAt).toBe(new Date(now * 1000).toISOString());
    expect(result.accessEndsAt).toBe(new Date(ends * 1000).toISOString());
    expect(result.cancellationScheduled).toBe(true);
    expect(result.subscriptionStatus).toBe("trialing");
    expect(result.accessCurrentlyValid).toBe(true);
  });

  it("2. cancel_at_period_end true with cancel_at null → scheduled", () => {
    const result = normalizeStripeCancellationState({
      status: "active",
      cancel_at_period_end: true,
      canceled_at: Math.floor(Date.now() / 1000),
      cancel_at: null,
    });
    expect(result.rawCancelAtPeriodEnd).toBe(true);
    expect(result.cancellationScheduled).toBe(true);
    expect(result.accessEndsAt).toBeNull();
    expect(result.accessCurrentlyValid).toBe(true);
  });

  it("3. no cancellation fields → not scheduled", () => {
    const result = normalizeStripeCancellationState({
      status: "trialing",
      cancel_at_period_end: false,
      canceled_at: null,
      cancel_at: null,
    });
    expect(result.cancellationScheduled).toBe(false);
    expect(result.cancellationRequestedAt).toBeNull();
    expect(result.accessEndsAt).toBeNull();
    expect(result.rawCancelAtPeriodEnd).toBe(false);
  });

  it("5. status remains trialing after cancellation request", () => {
    const result = normalizeStripeCancellationState({
      status: "trialing",
      cancel_at_period_end: false,
      canceled_at: 1_700_000_000,
      cancel_at: 1_700_100_000,
    });
    expect(result.subscriptionStatus).toBe("trialing");
    expect(result.accessCurrentlyValid).toBe(true);
  });

  it("6. status remains active after cancellation request", () => {
    const result = normalizeStripeCancellationState({
      status: "active",
      cancel_at_period_end: false,
      canceled_at: 1_700_000_000,
      cancel_at: 1_700_100_000,
    });
    expect(result.subscriptionStatus).toBe("active");
    expect(result.accessCurrentlyValid).toBe(true);
  });

  it("7. actual ended status removes access", () => {
    const result = normalizeStripeCancellationState({
      status: "canceled",
      cancel_at_period_end: false,
      canceled_at: 1_700_000_000,
      cancel_at: 1_700_100_000,
    });
    expect(result.subscriptionStatus).toBe("canceled");
    expect(result.accessCurrentlyValid).toBe(false);
  });
});

describe("formatCancellationLabel", () => {
  it("16. shows Cancels [date] from access_ends_at", () => {
    const label = formatCancellationLabel({
      subscriptionStatus: "trialing",
      cancelAtPeriodEnd: false,
      accessEndsAt: "2026-08-18T00:00:00.000Z",
    });
    expect(label).toMatch(/^Cancels /);
    expect(label?.toLowerCase()).not.toContain("canceled");
  });

  it("17. does not show Canceled while status is trialing/active", () => {
    for (const status of ["trialing", "active"] as const) {
      const label = formatCancellationLabel({
        subscriptionStatus: status,
        cancelAtPeriodEnd: true,
        accessEndsAt: null,
      });
      expect(label).toBe("Cancels at the end of the current billing period");
      expect(label?.toLowerCase()).not.toBe("canceled");
    }
  });

  it("shows nothing when no cancellation is scheduled", () => {
    expect(
      formatCancellationLabel({
        subscriptionStatus: "trialing",
        cancelAtPeriodEnd: false,
        accessEndsAt: null,
      }),
    ).toBeNull();
  });
});
