import { describe, expect, it } from "vitest";
import {
  buildSmsHref,
  friendInSmsMessage,
  getInitiatorShareStatus,
  mapAcceptFieldErrors,
  shouldRedirectInviteToLocked,
} from "./invite-ui";
import type { RunRow } from "./types";

const window = {
  date: "2026-07-21",
  preset: "lunch" as const,
  start: "12:00",
  end: "14:00",
};

function run(partial: Partial<RunRow> & Pick<RunRow, "status">): RunRow {
  return {
    id: "run-1",
    invite_token: "token-abc12345",
    member_id: "member-1",
    initiator_name: "Yohannes",
    initiator_phone: "+13105550199",
    initiator_email: "y@example.com",
    initiator_sms_consent: true,
    friend_name: "Alex",
    restaurant_name: "Esme",
    restaurant_link: null,
    location: null,
    time_option_one: window,
    time_option_two: null,
    personal_message: null,
    selected_time: null,
    friend_phone: null,
    friend_sms_consent: false,
    reward_status: "none",
    is_trial_reward: false,
    feedback: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    accepted_at: null,
    completed_at: null,
    reward_sent_at: null,
    ...partial,
  };
}

describe("locked SMS helpers", () => {
  it("builds message with restaurant and accepted time", () => {
    const message = friendInSmsMessage("Esme", window);
    expect(message).toContain("Esme");
    expect(message).toMatch(/Don't flake/);
    expect(message.toLowerCase()).toContain("i'm in for esme");
  });

  it("SMS link contains initiator phone, restaurant, and accepted time", () => {
    const message = friendInSmsMessage("Esme", window);
    const href = buildSmsHref("+13105550199", message);
    expect(href.startsWith("sms:+13105550199?body=")).toBe(true);
    const body = decodeURIComponent(href.split("?body=")[1] ?? "");
    expect(body).toContain("Esme");
    expect(body).toContain("I'm in for Esme");
    expect(body).toMatch(/Jul 21|July 21|Tuesday/);
  });
});

describe("initiator share status", () => {
  it("shows waiting before acceptance", () => {
    expect(getInitiatorShareStatus(run({ status: "ready" }))).toEqual({
      kind: "waiting",
      friendName: "Alex",
    });
  });

  it("shows accepted status with restaurant, time, and locked reward", () => {
    const status = getInitiatorShareStatus(
      run({
        status: "accepted",
        selected_time: window,
        reward_status: "reserved",
      }),
    );
    expect(status.kind).toBe("accepted");
    if (status.kind === "accepted") {
      expect(status.friendName).toBe("Alex");
      expect(status.restaurantName).toBe("Esme");
      expect(status.acceptedLabel).toContain("12");
    }
  });

  it("shows neither-time-works for time conflicts", () => {
    expect(getInitiatorShareStatus(run({ status: "time_conflict" }))).toEqual({
      kind: "conflict",
    });
  });
});

describe("duplicate acceptance routing", () => {
  it("accepted invites still redirect to the locked page", () => {
    expect(shouldRedirectInviteToLocked("accepted")).toBe(true);
    expect(shouldRedirectInviteToLocked("completed")).toBe(true);
    expect(shouldRedirectInviteToLocked("ready")).toBe(false);
  });
});

describe("mapAcceptFieldErrors", () => {
  it("maps consent-only failure without blaming time or phone", () => {
    expect(
      mapAcceptFieldErrors([{ path: ["friendSmsConsent"] }]),
    ).toEqual({
      friendSmsConsent: "Please agree to receive texts about this plan.",
    });
  });

  it("maps each missing field to its own message", () => {
    expect(
      mapAcceptFieldErrors([
        { path: ["selectedOption"] },
        { path: ["friendPhone"] },
        { path: ["friendSmsConsent"] },
      ]),
    ).toEqual({
      selectedOption: "Pick a time.",
      friendPhone: "Enter a valid 10-digit U.S. phone number.",
      friendSmsConsent: "Please agree to receive texts about this plan.",
    });
  });
});
