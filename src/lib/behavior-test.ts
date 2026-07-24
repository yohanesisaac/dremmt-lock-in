/**
 * Temporary "behavior-test" mode.
 *
 * When enabled, a brand-new visitor can create ONE plan without entering a
 * card: the app skips Stripe Checkout entirely and continues straight into the
 * normal share / invite / accept flow. It never touches Stripe (no session, no
 * fake customer / subscription IDs) and never marks the member active/trialing.
 *
 * Everything is gated behind a single environment flag so it can be turned on
 * and off in one place:
 *
 *   NEXT_PUBLIC_BEHAVIOR_TEST_MODE=1   → on
 *   (unset / anything else)            → off  (normal paid Stripe flow)
 *
 * The flag is NEXT_PUBLIC_ on purpose so the same value drives both the server
 * (checkout route, success page) and the client (create flow paywall skip).
 *
 * Records created in this mode are marked with the `is_behavior_test` column on
 * `members` / `runs` (see migration 0006). Writing that column is best-effort:
 * if the migration has not been applied yet the app still works, it just can't
 * durably flag the rows until the column exists.
 */

/** How many card-free plans a single behavior-test visitor may create. */
export const BEHAVIOR_TEST_PLAN_LIMIT = 1;

/** Run statuses that count as "already created a plan" for the cap above. */
export const BEHAVIOR_TEST_CONSUMED_STATUSES = [
  "ready",
  "pending_friend",
  "accepted",
  "completed",
] as const;

/** Pure parser so the toggle logic is unit-testable without env plumbing. */
export function parseBehaviorTestMode(raw: string | undefined | null): boolean {
  if (raw == null) return false;
  const value = String(raw).trim().toLowerCase();
  return value === "1" || value === "true" || value === "on" || value === "yes";
}

/**
 * Whether behavior-test mode is currently enabled.
 *
 * Reads the literal `process.env.NEXT_PUBLIC_BEHAVIOR_TEST_MODE` so Next.js can
 * statically inline it into the client bundle.
 */
export function isBehaviorTestMode(): boolean {
  return parseBehaviorTestMode(process.env.NEXT_PUBLIC_BEHAVIOR_TEST_MODE);
}

/**
 * Detect the PostgREST error raised when we try to write `is_behavior_test`
 * before migration 0006 has been applied. Used to retry the write without the
 * flag so the flow keeps working on an un-migrated database.
 */
export function isMissingBehaviorTestColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  if (e.code === "PGRST204") return true;
  const message = (e.message ?? "").toLowerCase();
  return (
    message.includes("is_behavior_test") &&
    (message.includes("does not exist") ||
      message.includes("could not find") ||
      message.includes("schema cache"))
  );
}
