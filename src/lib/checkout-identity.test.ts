import { describe, expect, it } from "vitest";
import { normalizeUsPhone } from "./phone";
import { decideCheckoutAccess, pickMemberForPhone } from "./membership-identity";
import type { MemberRow } from "./types";

/**
 * End-to-end identity scenarios for Checkout, expressed against the same pure
 * helpers the route uses (phone normalize → lookup pick → access decision).
 * The route itself must never consult the member cookie for eligibility.
 */

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
    is_behavior_test: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    ...partial,
  };
}

function resolve(submittedPhone: string, dbRows: MemberRow[]) {
  const normalized = normalizeUsPhone(submittedPhone);
  if (!normalized.ok) {
    return { kind: "invalid_phone" as const, error: normalized.error };
  }
  const matches = dbRows.filter((row) => {
    const rowPhone = row.phone ? normalizeUsPhone(row.phone) : null;
    return rowPhone?.ok && rowPhone.phone === normalized.phone;
  });
  const picked = pickMemberForPhone(matches);
  return decideCheckoutAccess({ member: picked });
}

describe("Checkout identity scenarios", () => {
  it("1. new phone in a fresh browser → Checkout", () => {
    const decision = resolve("3105550100", []);
    expect(decision).toMatchObject({ kind: "checkout", member: null });
  });

  it("2. new phone in a browser with an old member cookie → still Checkout", () => {
    // Cookie member is intentionally omitted from dbRows for this phone.
    const decision = resolve("3105550100", [
      member({
        id: "cookie-person",
        phone: "+13105559999",
        subscription_status: "active",
      }),
    ]);
    expect(decision).toMatchObject({ kind: "checkout", member: null });
  });

  it("3. existing trialing phone → bypass", () => {
    const decision = resolve("(310) 555-0199", [
      member({
        id: "trial",
        phone: "+13105550199",
        subscription_status: "trialing",
      }),
    ]);
    expect(decision.kind).toBe("bypass");
  });

  it("4. existing active phone → bypass", () => {
    const decision = resolve("310-555-0199", [
      member({
        id: "active",
        phone: "3105550199",
        subscription_status: "active",
      }),
    ]);
    expect(decision.kind).toBe("bypass");
  });

  it("5. cookie phone ≠ submitted phone → cookie ignored, Checkout", () => {
    const decision = resolve("4245550100", [
      member({
        id: "other",
        phone: "+13105550199",
        subscription_status: "active",
      }),
    ]);
    expect(decision).toMatchObject({ kind: "checkout", member: null });
  });

  it("6. canceled member phone → Checkout not bypassed", () => {
    const decision = resolve("3105550199", [
      member({
        id: "canceled",
        phone: "+13105550199",
        subscription_status: "canceled",
      }),
    ]);
    expect(decision.kind).toBe("checkout");
  });

  it("7. failed lookup → deny / fail closed", () => {
    expect(
      decideCheckoutAccess({ lookupError: "boom", member: null }).kind,
    ).toBe("deny");
  });

  it("8. same phone different formatting → same member", () => {
    const rows = [
      member({
        id: "one",
        phone: "(310) 555-0199",
        subscription_status: "active",
      }),
    ];
    const a = resolve("+1 (310) 555-0199", rows);
    const b = resolve("3105550199", rows);
    expect(a.kind).toBe("bypass");
    expect(b.kind).toBe("bypass");
    if (a.kind === "bypass" && b.kind === "bypass") {
      expect(a.member.id).toBe(b.member.id);
    }
  });

  it("9. repeated plan creation with same phone reuses one member (no new row needed)", () => {
    const existing = member({
      id: "existing",
      phone: "+13105550199",
      subscription_status: "inactive",
      stripe_customer_id: null,
    });
    const decision = resolve("3105550199", [existing, existing]);
    // Inactive → checkout path, but member is reused (not null).
    expect(decision).toMatchObject({ kind: "checkout", member: { id: "existing" } });
  });

  it("10. invalid phone → specific validation error", () => {
    const decision = resolve("123", []);
    expect(decision).toMatchObject({ kind: "invalid_phone" });
    if (decision.kind === "invalid_phone") {
      expect(decision.error.toLowerCase()).toMatch(/phone|digit/);
    }
  });

  it("11. valid phone + active membership → bypass (no generic plan failure)", () => {
    const decision = resolve("3105550199", [
      member({
        id: "ok",
        phone: "+13105550199",
        subscription_status: "active",
      }),
    ]);
    expect(decision.kind).toBe("bypass");
  });
});
