import type { RunRow, RunStatus, TimeWindow } from "./types";
import { formatTimeWindow } from "./time-windows";

/** Prefill for the friend → initiator SMS after locking in. */
export function friendInSmsMessage(
  restaurantName: string,
  acceptedWindow: TimeWindow,
): string {
  return `I'm in for ${restaurantName} on ${formatTimeWindow(acceptedWindow)}. Don't flake 😭`;
}

/** Standard `sms:` link. Works on mobile; desktop may open a handler or fail gracefully. */
export function buildSmsHref(phone: string, body: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return `sms:${digits}?body=${encodeURIComponent(body)}`;
}

export type InitiatorShareStatus =
  | { kind: "waiting"; friendName: string }
  | {
      kind: "accepted";
      friendName: string;
      restaurantName: string;
      acceptedLabel: string;
    }
  | { kind: "conflict" }
  | { kind: "other"; status: RunStatus };

/** Concise initiator-facing status for the success/share page. */
export function getInitiatorShareStatus(run: RunRow): InitiatorShareStatus {
  if (run.status === "time_conflict") {
    return { kind: "conflict" };
  }

  if (run.status === "accepted" || run.status === "completed") {
    const window = run.selected_time ?? run.time_option_one;
    return {
      kind: "accepted",
      friendName: run.friend_name,
      restaurantName: run.restaurant_name,
      acceptedLabel: formatTimeWindow(window),
    };
  }

  if (
    run.status === "ready" ||
    run.status === "pending_friend" ||
    run.status === "awaiting_payment"
  ) {
    return { kind: "waiting", friendName: run.friend_name };
  }

  return { kind: "other", status: run.status };
}

/** Accepted/completed invites always route to the locked page. */
export function shouldRedirectInviteToLocked(status: RunStatus): boolean {
  return status === "accepted" || status === "completed";
}
