/**
 * Central editable reward configuration for the Dremmt pilot.
 *
 * The reward is provided by Dremmt during the pilot — never described as
 * funded or provided by the restaurant. Change the wording and the (internal)
 * value here in ONE place; nothing else in the app hard-codes reward copy.
 */
export const rewardConfig = {
  /** Guaranteed minimum amount attached to every completed, accepted plan. */
  guaranteedMinimumLabel: "$6",

  /** How many completed plans can carry that guarantee per calendar month. */
  monthlyPlanLimit: 3,

  /** Length of the free trial before the first charge. */
  trialDays: 14,

  /** How many completed plans a member can activate during the whole trial. */
  trialPlanLimit: 1,

  /** Short, friendly name for the reward. Used sparingly. */
  title: "A little something for the table",

  /** The core reward promise — shown near pricing and on the locked page. */
  promise: "Every completed plan unlocks at least $6 toward the outing.",

  /** Heading for the "what completing a plan looks like" section. */
  photoHeading: "Let the camera eat.",

  /** What it actually takes to complete a plan and receive the reward. */
  photoDescription:
    "Send one photo of the food, the table, or the two of you. No receipt required. At least $6 toward the outing will be with you shortly.",

  /** Extra reassurance about what counts as a photo. */
  photoNote: "Faces are optional.",

  /** Pilot delivery timing — stated in terms and on the locked page. */
  deliveryNote: "During the pilot, completed rewards are sent within 24 hours.",

  /**
   * Internal fulfillment note. Only shown in the private admin dashboard, so
   * you can adjust what the pilot reward actually is. Edit freely.
   */
  internalValue:
    "Pilot reward — minimum $6 per completed plan, occasionally more. Set the exact payout process here.",
} as const;

export type RewardConfig = typeof rewardConfig;
