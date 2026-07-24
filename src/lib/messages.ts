import type { RunRow } from "./types";
import { formatTimeWindowShort } from "./time-windows";

function activeWindow(run: RunRow) {
  return run.selected_time ?? run.time_option_one;
}

/** Suggested message the initiator sends to their friend with the invite link. */
export function friendShareMessage(run: RunRow): string {
  const restaurant = run.restaurant_name?.trim();
  if (!restaurant) {
    return "I made us a Dremmt plan — pick the time that works for you:";
  }
  return `I made us a Dremmt plan for ${restaurant} — pick the time that works for you:`;
}

/** Day-of reminder for the initiator (sent manually from the Dremmt number). */
export function initiatorReminder(run: RunRow): string {
  const time = formatTimeWindowShort(activeWindow(run));
  return `Today's the day 🙂 You and ${run.friend_name} are locked in for ${run.restaurant_name} between ${time}. Enjoy yourselves. Send us a quick table moment before you leave to unlock at least $6 toward the outing.`;
}

/** Day-of reminder for the friend (sent manually from the Dremmt number). */
export function friendReminder(run: RunRow): string {
  const time = formatTimeWindowShort(activeWindow(run));
  return `Today's the day 🙂 You and ${run.initiator_name} are locked in for ${run.restaurant_name} between ${time}. Enjoy — send a quick table moment before you leave to unlock at least $6 for you two.`;
}

/** Completion follow-up asking whether Dremmt helped. */
export function completionFollowUp(): string {
  return "Did Dremmt help this plan actually happen?";
}

export const FEEDBACK_OPTIONS = [
  "Yes—we probably would have delayed it",
  "Maybe—we likely would have gone anyway",
  "No—the reward made no difference",
  "We did not end up going",
] as const;
