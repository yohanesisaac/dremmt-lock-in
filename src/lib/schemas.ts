import { z } from "zod";
import { normalizeUsPhone } from "./phone";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Choose an exact date." });

const clockString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Use a valid time." });

/** Accept formatted input, emit canonical `+1XXXXXXXXXX`. */
const phoneString = z.string().trim().transform((value, ctx) => {
  const result = normalizeUsPhone(value);
  if (!result.ok) {
    ctx.addIssue({
      code: "custom",
      message: result.error,
    });
    return z.NEVER;
  }
  return result.phone;
});

export const timeWindowSchema = z.object({
  date: dateString,
  preset: z.enum(["lunch", "afternoon", "evening", "custom"]),
  start: clockString,
  end: clockString,
});

export const createRunSchema = z
  .object({
    initiatorName: z.string().trim().min(1, { error: "Add your first name." }).max(60),
    friendName: z
      .string()
      .trim()
      .min(1, { error: "Add your friend's first name." })
      .max(60),
    restaurantName: z
      .string()
      .trim()
      .min(1, { error: "Add the restaurant name." })
      .max(120),
    restaurantLink: z
      .union([z.string().trim().url({ error: "Enter a valid link." }), z.literal("")])
      .optional(),
    location: z.string().trim().max(120).optional(),
    timeOptionOne: timeWindowSchema,
    timeOptionTwo: timeWindowSchema.nullable().optional(),
    personalMessage: z.string().trim().max(400).optional(),
    initiatorPhone: phoneString,
    initiatorEmail: z.email({ error: "Enter a valid email." }).max(160),
    initiatorSmsConsent: z.literal(true, {
      error: "Please agree to receive texts about this Dremmt run.",
    }),
  })
  .refine((data) => data.timeOptionOne.end > data.timeOptionOne.start, {
    error: "The first window's end time must be after its start time.",
    path: ["timeOptionOne"],
  })
  .refine(
    (data) =>
      !data.timeOptionTwo || data.timeOptionTwo.end > data.timeOptionTwo.start,
    {
      error: "The second window's end time must be after its start time.",
      path: ["timeOptionTwo"],
    },
  );

export type CreateRunInput = z.infer<typeof createRunSchema>;

export const acceptRunSchema = z.object({
  token: z.string().trim().min(10),
  selectedOption: z.union([z.literal(1), z.literal(2)]),
  friendPhone: phoneString,
  friendSmsConsent: z.literal(true, {
    error: "Please agree to receive texts about this plan.",
  }),
});

export type AcceptRunInput = z.infer<typeof acceptRunSchema>;

export const declineRunSchema = z.object({
  token: z.string().trim().min(10),
});

/** First human-readable Zod issue for safer API responses. */
export function firstZodErrorMessage(
  error: z.ZodError,
  fallback = "Please check the plan details and try again.",
): string {
  const issue = error.issues[0];
  if (!issue) return fallback;

  const path = issue.path.join(".");
  const message = issue.message;

  if (path.includes("initiatorPhone") || path.includes("friendPhone")) {
    return message || "Invalid phone number.";
  }
  if (path.includes("initiatorEmail")) {
    return message || "Enter a valid email.";
  }
  if (path.includes("timeOptionOne.date") || path.includes("timeOptionTwo.date")) {
    return "Missing exact date.";
  }
  if (path.includes("timeOptionOne") || path.includes("timeOptionTwo")) {
    return message || "Invalid time window.";
  }
  if (path.includes("restaurantLink")) {
    return message || "Enter a valid restaurant link.";
  }

  return message || fallback;
}
