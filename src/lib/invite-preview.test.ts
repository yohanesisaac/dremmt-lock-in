import { describe, expect, it } from "vitest";
import { buildInvitePreview } from "./invite-preview";
import type { TimeWindow } from "./types";

const lunch: TimeWindow = {
  date: "2026-07-28",
  preset: "lunch",
  start: "12:00",
  end: "14:00",
};
const dinner: TimeWindow = {
  date: "2026-07-29",
  preset: "evening",
  start: "19:00",
  end: "21:00",
};

describe("buildInvitePreview", () => {
  it("uses organizer + restaurant when both are present", () => {
    const preview = buildInvitePreview({
      initiator_name: "Yohannes",
      restaurant_name: "Esme",
      time_option_one: lunch,
      time_option_two: null,
    });
    expect(preview.eyebrow).toBe("You've been invited");
    expect(preview.organizerLine).toBe(
      "Yohannes invited you to grab a meal at Esme",
    );
    expect(preview.secondary).toBe("Pick a time and lock it in");
    expect(preview.cta).toBe("Open invite");
    expect(preview.metaTitle).toBe(
      "Yohannes invited you to grab a meal at Esme",
    );
    expect(preview.metaDescription).toBe("Pick a time and lock it in with Dremmt.");
  });

  it("drops the restaurant when it is missing", () => {
    const preview = buildInvitePreview({
      initiator_name: "Yohannes",
      restaurant_name: "  ",
      time_option_one: lunch,
      time_option_two: null,
    });
    expect(preview.organizerLine).toBe("Yohannes invited you to grab a meal");
    expect(preview.metaTitle).toBe("Yohannes invited you to grab a meal");
  });

  it("falls back to a branded line when the organizer is missing", () => {
    const preview = buildInvitePreview({
      initiator_name: null,
      restaurant_name: "Esme",
    });
    expect(preview.eyebrow).toBe("An invitation");
    expect(preview.organizerLine).toBe("You've been invited to grab a meal");
    expect(preview.metaTitle).toBe("You've been invited to grab a meal");
  });

  it("handles a completely empty run", () => {
    const preview = buildInvitePreview(null);
    expect(preview.organizerLine).toBe("You've been invited to grab a meal");
    expect(preview.chips).toEqual([]);
  });

  it("includes up to two time chips when available", () => {
    const preview = buildInvitePreview({
      initiator_name: "Yohannes",
      restaurant_name: "Esme",
      time_option_one: lunch,
      time_option_two: dinner,
    });
    expect(preview.chips).toHaveLength(2);
    expect(preview.chips[0]).toContain("·");
  });

  it("omits chips when time windows are missing or invalid", () => {
    const preview = buildInvitePreview({
      initiator_name: "Yohannes",
      restaurant_name: "Esme",
      time_option_one: undefined,
      time_option_two: null,
    });
    expect(preview.chips).toEqual([]);
  });
});
