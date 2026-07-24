import type { RunRow, TimeWindow } from "./types";
import { formatTimeWindowShort } from "./time-windows";

/**
 * Shared, presentation-only content for an invitation's social preview.
 *
 * This is the single source of truth for the copy shown in BOTH the dynamic
 * Open Graph image (`opengraph-image.tsx`) and the page metadata
 * (`generateMetadata`). It never reads Stripe/pricing details — the invite
 * preview intentionally stays social and warm, not promotional.
 */
export interface InvitePreviewContent {
  /** Small kicker above the headline, e.g. "You've been invited". */
  eyebrow: string;
  /** The personalized statement, e.g. "Yohannes wants to go to Esme with you". */
  organizerLine: string;
  /** Short supporting line, e.g. "Pick a time and lock it in". */
  secondary: string;
  /** CTA label rendered as a pill, e.g. "Open invite". */
  cta: string;
  /** Up to two formatted time windows; omitted when unavailable. */
  chips: string[];
  /** Subtle, secondary reward note. */
  rewardNote: string;
  /** <title> / og:title, e.g. "Yohannes invited you to Esme". */
  metaTitle: string;
  /** Meta description, e.g. "Pick a time and lock it in with Dremmt." */
  metaDescription: string;
  /** Alt text for the generated image. */
  imageAlt: string;
}

const GENERIC_ORGANIZER_LINE = "You've been invited to grab a meal";
const SECONDARY_LINE = "Pick a time and lock it in";
const CTA_LABEL = "Open invite";
const REWARD_NOTE = "Show up together to unlock the meal reward";
const META_DESCRIPTION = "Pick a time and lock it in with Dremmt.";

function clean(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Format a time window into a chip label, tolerating missing/invalid data. */
function chipFor(window: TimeWindow | null | undefined): string | null {
  if (!window || typeof window.date !== "string" || !window.date) return null;
  try {
    const label = formatTimeWindowShort(window);
    return label.trim() ? label : null;
  } catch {
    return null;
  }
}

type PreviewSource = Partial<
  Pick<
    RunRow,
    "initiator_name" | "restaurant_name" | "time_option_one" | "time_option_two"
  >
>;

/**
 * Derive the invitation preview content from a run (or a partial subset).
 *
 * Fallbacks:
 * - No restaurant (organizer present) → "{organizer} invited you out"
 * - No organizer                      → "You've been invited with Dremmt"
 */
export function buildInvitePreview(
  run: PreviewSource | null | undefined,
): InvitePreviewContent {
  const organizer = clean(run?.initiator_name);
  const restaurant = clean(run?.restaurant_name);

  const chips = [chipFor(run?.time_option_one), chipFor(run?.time_option_two)]
    .filter((chip): chip is string => Boolean(chip))
    .slice(0, 2);

  let eyebrow = "You've been invited";
  let organizerLine: string;
  let metaTitle: string;

  if (organizer && restaurant) {
    organizerLine = `${organizer} invited you to grab a meal at ${restaurant}`;
    metaTitle = `${organizer} invited you to grab a meal at ${restaurant}`;
  } else if (organizer) {
    organizerLine = `${organizer} invited you to grab a meal`;
    metaTitle = `${organizer} invited you to grab a meal`;
  } else {
    // No organizer name — keep it branded and avoid duplicating the eyebrow.
    eyebrow = "An invitation";
    organizerLine = GENERIC_ORGANIZER_LINE;
    metaTitle = GENERIC_ORGANIZER_LINE;
  }

  return {
    eyebrow,
    organizerLine,
    secondary: SECONDARY_LINE,
    cta: CTA_LABEL,
    chips,
    rewardNote: REWARD_NOTE,
    metaTitle,
    metaDescription: META_DESCRIPTION,
    imageAlt: metaTitle,
  };
}
