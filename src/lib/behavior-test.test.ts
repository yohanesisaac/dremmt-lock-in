import { describe, expect, it } from "vitest";
import {
  parseBehaviorTestMode,
  isMissingBehaviorTestColumnError,
  BEHAVIOR_TEST_PLAN_LIMIT,
} from "./behavior-test";

describe("parseBehaviorTestMode", () => {
  it("is off when unset / empty / falsey strings", () => {
    for (const raw of [undefined, null, "", "  ", "0", "false", "off", "no", "nope"]) {
      expect(parseBehaviorTestMode(raw)).toBe(false);
    }
  });

  it("is on for the accepted truthy values (case-insensitive)", () => {
    for (const raw of ["1", "true", "TRUE", "on", "On", "yes", " yes "]) {
      expect(parseBehaviorTestMode(raw)).toBe(true);
    }
  });
});

describe("BEHAVIOR_TEST_PLAN_LIMIT", () => {
  it("allows exactly one card-free plan", () => {
    expect(BEHAVIOR_TEST_PLAN_LIMIT).toBe(1);
  });
});

describe("isMissingBehaviorTestColumnError", () => {
  it("detects the PostgREST missing-column error before migration 0006", () => {
    expect(isMissingBehaviorTestColumnError({ code: "PGRST204" })).toBe(true);
    expect(
      isMissingBehaviorTestColumnError({
        message:
          "Could not find the 'is_behavior_test' column of 'runs' in the schema cache",
      }),
    ).toBe(true);
    expect(
      isMissingBehaviorTestColumnError({
        message: 'column "is_behavior_test" does not exist',
      }),
    ).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isMissingBehaviorTestColumnError(null)).toBe(false);
    expect(isMissingBehaviorTestColumnError({ code: "23505" })).toBe(false);
    expect(
      isMissingBehaviorTestColumnError({ message: "some other failure" }),
    ).toBe(false);
  });
});
