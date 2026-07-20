import type { TimeWindow, WindowPreset } from "./types";

export const WINDOW_PRESETS: Record<
  Exclude<WindowPreset, "custom">,
  { label: string; start: string; end: string }
> = {
  lunch: { label: "Lunch", start: "12:00", end: "14:00" },
  afternoon: { label: "Afternoon", start: "14:00", end: "17:00" },
  evening: { label: "Evening", start: "17:00", end: "20:00" },
};

/** Format a 24h "HH:MM" string as a friendly "12:00 PM". */
export function formatClock(time: string): string {
  const [hStr, mStr] = time.split(":");
  const hours = Number(hStr);
  const minutes = Number(mStr);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = minutes === 0 ? "" : `:${String(minutes).padStart(2, "0")}`;
  return `${displayHour}${displayMinutes} ${period}`;
}

/** Format a range like "12:00–2:00 PM" (collapsing the shared AM/PM). */
export function formatWindowRange(start: string, end: string): string {
  const startFull = formatClock(start);
  const endFull = formatClock(end);
  const startPeriod = startFull.slice(-2);
  const endPeriod = endFull.slice(-2);
  if (startPeriod === endPeriod) {
    return `${startFull.slice(0, -3)}–${endFull}`;
  }
  return `${startFull}–${endFull}`;
}

/** Format a date like "Tuesday, Jul 22". */
export function formatDate(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateIso;
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

/** Format a date like "Tuesday, July 22" (full month name). */
export function formatDateFull(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateIso;
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * The selectable time options offered in the scheduling sub-flow. Each maps to
 * a concrete {@link TimeWindow} start/end so the invitation, acceptance, and
 * database format stay identical to the rest of the app.
 */
export const SCHEDULE_TIME_OPTIONS = [
  {
    id: "lunch",
    label: "12–2 PM",
    descriptor: "lunch",
    preset: "lunch",
    start: "12:00",
    end: "14:00",
  },
  {
    id: "afternoon",
    label: "2–5 PM",
    descriptor: "afternoon",
    preset: "afternoon",
    start: "14:00",
    end: "17:00",
  },
  {
    id: "early-dinner",
    label: "5–7 PM",
    descriptor: "early dinner",
    preset: "evening",
    start: "17:00",
    end: "19:00",
  },
  {
    id: "dinner",
    label: "7–9 PM",
    descriptor: "dinner",
    preset: "evening",
    start: "19:00",
    end: "21:00",
  },
] as const;

export type ScheduleTimeOptionId = (typeof SCHEDULE_TIME_OPTIONS)[number]["id"];

export function timeOptionById(id: ScheduleTimeOptionId) {
  return SCHEDULE_TIME_OPTIONS.find((option) => option.id === id) ?? null;
}

/** A single day + selected time option, before it becomes a {@link TimeWindow}. */
export interface DateTimeCombo {
  date: string;
  optionId: ScheduleTimeOptionId;
}

/** Convert a picked combo into the canonical {@link TimeWindow} shape. */
export function comboToWindow(combo: DateTimeCombo): TimeWindow {
  const option = timeOptionById(combo.optionId) ?? SCHEDULE_TIME_OPTIONS[0];
  return {
    date: combo.date,
    preset: option.preset,
    start: option.start,
    end: option.end,
  };
}

/** A Date -> local "YYYY-MM-DD" (never shifts across the UTC boundary). */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Full human window, e.g. "Tuesday, Jul 22 · 12:00–2:00 PM". */
export function formatTimeWindow(window: TimeWindow): string {
  return `${formatDate(window.date)} · ${formatWindowRange(window.start, window.end)}`;
}

/** Short window used in tight invitation lines, e.g. "Tuesday · 12–2 PM". */
export function formatTimeWindowShort(window: TimeWindow): string {
  const date = new Date(`${window.date}T00:00:00`);
  const weekday = Number.isNaN(date.getTime())
    ? window.date
    : date.toLocaleDateString("en-US", { weekday: "long" });
  return `${weekday} · ${formatWindowRange(window.start, window.end)}`;
}
