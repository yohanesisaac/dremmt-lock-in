import { describe, expect, it } from "vitest";
import {
  normalizeUsPhone,
  phoneLookupCandidates,
  phonesMatch,
} from "./phone";
import { createRunSchema, firstZodErrorMessage } from "./schemas";

describe("normalizeUsPhone", () => {
  it("canonicalizes 10-digit US numbers", () => {
    expect(normalizeUsPhone("3105550199")).toEqual({
      ok: true,
      phone: "+13105550199",
    });
  });

  it("accepts formatting and +1 prefix as the same number", () => {
    const a = normalizeUsPhone("(310) 555-0199");
    const b = normalizeUsPhone("+1 310-555-0199");
    const c = normalizeUsPhone("1 (310) 555 0199");
    expect(a).toEqual({ ok: true, phone: "+13105550199" });
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it("rejects short / invalid phones with a specific message", () => {
    const short = normalizeUsPhone("5550199");
    expect(short.ok).toBe(false);
    if (!short.ok) {
      expect(short.error).toMatch(/10-digit/i);
    }

    const letters = normalizeUsPhone("call-me");
    expect(letters.ok).toBe(false);
  });

  it("rejects impossible lengths", () => {
    const long = normalizeUsPhone("13105550199123");
    expect(long.ok).toBe(false);
    if (!long.ok) {
      expect(long.error).toMatch(/too long/i);
    }
  });
});

describe("phonesMatch / candidates", () => {
  it("treats differently formatted phones as the same", () => {
    expect(phonesMatch("(310) 555-0199", "+13105550199")).toBe(true);
    expect(phonesMatch("3105550199", "310-555-0000")).toBe(false);
  });

  it("includes legacy formats in lookup candidates", () => {
    const candidates = phoneLookupCandidates("+13105550199");
    expect(candidates).toContain("+13105550199");
    expect(candidates).toContain("3105550199");
    expect(candidates).toContain("13105550199");
    expect(candidates).toContain("(310) 555-0199");
  });
});

describe("createRunSchema phone validation", () => {
  const validPlan = {
    initiatorName: "Yohannes",
    friendName: "Alex",
    restaurantName: "Esme",
    timeOptionOne: {
      date: "2026-07-21",
      preset: "lunch" as const,
      start: "12:00",
      end: "14:00",
    },
    timeOptionTwo: null,
    initiatorPhone: "(310) 555-0199",
    initiatorEmail: "test@example.com",
    initiatorSmsConsent: true as const,
  };

  it("accepts a valid phone + plan and emits canonical phone", () => {
    const parsed = createRunSchema.safeParse(validPlan);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.initiatorPhone).toBe("+13105550199");
    }
  });

  it("returns a specific invalid-phone message instead of a generic failure", () => {
    const parsed = createRunSchema.safeParse({
      ...validPlan,
      initiatorPhone: "123",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const message = firstZodErrorMessage(parsed.error);
      expect(message).not.toBe("Please check the plan details and try again.");
      expect(message.toLowerCase()).toMatch(/phone/);
    }
  });
});
