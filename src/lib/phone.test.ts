import { describe, expect, it } from "vitest";
import {
  caretAfterFormat,
  formatUsPhoneDisplay,
  normalizeUsPhone,
  phoneLookupCandidates,
  phonesMatch,
  PHONE_VALIDATION_ERROR,
  toNationalDigits,
} from "./phone";
import { createRunSchema, firstZodErrorMessage } from "./schemas";

describe("formatUsPhoneDisplay / toNationalDigits", () => {
  it("1. raw 10 digits formats correctly", () => {
    expect(formatUsPhoneDisplay("3109028228")).toBe("(310) 902-8228");
  });

  it("2. parentheses format is accepted for display", () => {
    expect(formatUsPhoneDisplay("(310) 902-8228")).toBe("(310) 902-8228");
  });

  it("3. hyphen format is accepted for display", () => {
    expect(formatUsPhoneDisplay("310-902-8228")).toBe("(310) 902-8228");
  });

  it("4. +1 format is accepted for display", () => {
    expect(formatUsPhoneDisplay("+1 310 902 8228")).toBe("(310) 902-8228");
  });

  it("5. leading-1 format is accepted for display", () => {
    expect(formatUsPhoneDisplay("13109028228")).toBe("(310) 902-8228");
    expect(toNationalDigits("13109028228")).toBe("3109028228");
  });

  it("6. pasted formatted value works", () => {
    expect(formatUsPhoneDisplay("+1 (310) 902-8228")).toBe("(310) 902-8228");
  });

  it("limits display to 10 national digits", () => {
    expect(formatUsPhoneDisplay("31090282289999")).toBe("(310) 902-8228");
  });

  it("preserves caret after formatting", () => {
    const prev = "310902";
    const next = formatUsPhoneDisplay(prev);
    expect(next).toBe("(310) 902");
    expect(caretAfterFormat(prev, prev.length, next)).toBe(next.length);
  });
});

describe("normalizeUsPhone", () => {
  it("9. canonical result is +1XXXXXXXXXX", () => {
    expect(normalizeUsPhone("3109028228")).toEqual({
      ok: true,
      phone: "+13109028228",
    });
    expect(normalizeUsPhone("(310) 902-8228")).toEqual({
      ok: true,
      phone: "+13109028228",
    });
    expect(normalizeUsPhone("310-902-8228")).toEqual({
      ok: true,
      phone: "+13109028228",
    });
    expect(normalizeUsPhone("+1 310 902 8228")).toEqual({
      ok: true,
      phone: "+13109028228",
    });
    expect(normalizeUsPhone("13109028228")).toEqual({
      ok: true,
      phone: "+13109028228",
    });
  });

  it("7. short number fails", () => {
    const short = normalizeUsPhone("5550199");
    expect(short).toEqual({ ok: false, error: PHONE_VALIDATION_ERROR });
  });

  it("8. long invalid number fails", () => {
    const long = normalizeUsPhone("13109028228123");
    expect(long).toEqual({ ok: false, error: PHONE_VALIDATION_ERROR });
  });

  it("does not reject a valid raw 10-digit number before display formatting", () => {
    const raw = normalizeUsPhone("3109028228");
    expect(raw.ok).toBe(true);
  });

  it("accepts unicode punctuation by stripping to digits", () => {
    expect(normalizeUsPhone("310–902–8228")).toEqual({
      ok: true,
      phone: "+13109028228",
    });
  });
});

describe("phonesMatch / candidates", () => {
  it("treats differently formatted phones as the same", () => {
    expect(phonesMatch("(310) 902-8228", "+13109028228")).toBe(true);
    expect(phonesMatch("3109028228", "310-902-0000")).toBe(false);
  });

  it("includes legacy formats in lookup candidates", () => {
    const candidates = phoneLookupCandidates("+13109028228");
    expect(candidates).toContain("+13109028228");
    expect(candidates).toContain("3109028228");
    expect(candidates).toContain("13109028228");
    expect(candidates).toContain("(310) 902-8228");
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
    initiatorPhone: "(310) 902-8228",
    initiatorEmail: "test@example.com",
    initiatorSmsConsent: true as const,
  };

  it("accepts a valid phone + plan and emits canonical phone", () => {
    const parsed = createRunSchema.safeParse(validPlan);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.initiatorPhone).toBe("+13109028228");
    }
  });

  it("returns the U.S. phone validation message", () => {
    const parsed = createRunSchema.safeParse({
      ...validPlan,
      initiatorPhone: "123",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const message = firstZodErrorMessage(parsed.error);
      expect(message).toBe(PHONE_VALIDATION_ERROR);
    }
  });
});
