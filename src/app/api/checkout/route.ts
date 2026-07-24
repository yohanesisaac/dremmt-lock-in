import { NextRequest, NextResponse } from "next/server";
import { createRunSchema, firstZodErrorMessage } from "@/lib/schemas";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { serverEnv, resolveSiteUrl } from "@/lib/env";
import { generateToken } from "@/lib/tokens";
import { findMemberByNormalizedPhone } from "@/lib/data";
import {
  decideCheckoutAccess,
  resolveEmailUpdate,
} from "@/lib/membership-identity";
import {
  getMemberAllowance,
  formatResetDate,
} from "@/lib/reward-period";
import { shouldOfferCheckoutTrial } from "@/lib/returning-member";
import { rewardConfig } from "@/config/reward";
import {
  isBehaviorTestMode,
  isMissingBehaviorTestColumnError,
  BEHAVIOR_TEST_PLAN_LIMIT,
  BEHAVIOR_TEST_CONSUMED_STATUSES,
} from "@/lib/behavior-test";
import type { MemberRow, TimeWindow } from "@/lib/types";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

const isDev = process.env.NODE_ENV !== "production";

function validationError(error: string, fieldErrors?: unknown) {
  if (isDev) {
    console.error("[checkout] validation failed:", error, fieldErrors ?? "");
  }
  return NextResponse.json(
    {
      error,
      ...(isDev && fieldErrors ? { fieldErrors } : {}),
    },
    { status: 422 },
  );
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = createRunSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError(
      firstZodErrorMessage(parsed.error),
      parsed.error.flatten().fieldErrors,
    );
  }

  const input = parsed.data;
  // Schema already emitted the canonical +1XXXXXXXXXX phone.
  const canonicalPhone = input.initiatorPhone;
  const supabase = getSupabaseAdmin();

  const timeOne: TimeWindow = input.timeOptionOne;
  const timeTwo: TimeWindow | null = input.timeOptionTwo ?? null;

  if (!timeOne?.date) {
    return validationError("Missing exact date.");
  }

  const runBase = {
    initiator_name: input.initiatorName,
    initiator_phone: canonicalPhone,
    initiator_email: input.initiatorEmail,
    initiator_sms_consent: input.initiatorSmsConsent,
    friend_name: input.friendName,
    restaurant_name: input.restaurantName,
    restaurant_link: input.restaurantLink ? input.restaurantLink : null,
    location: input.location ? input.location : null,
    time_option_one: timeOne,
    time_option_two: timeTwo,
    personal_message: input.personalMessage ? input.personalMessage : null,
  };

  // Membership eligibility is determined ONLY by normalized phone lookup.
  // Cookies / browser state are ignored here on purpose.
  const lookup = await findMemberByNormalizedPhone(canonicalPhone);
  if (!lookup.ok) {
    return NextResponse.json({ error: lookup.error }, { status: 503 });
  }

  if (lookup.matches.length > 1 && isDev) {
    console.warn(
      `[checkout] duplicate members for phone ${canonicalPhone}: ${lookup.matches.length} rows`,
      lookup.matches.map((m) => m.id),
    );
  }

  const access = decideCheckoutAccess({ member: lookup.member });

  if (access.kind === "deny") {
    return NextResponse.json({ error: access.reason }, { status: 503 });
  }

  // --- Path A: phone matches a trialing/active member → Checkout bypass ---
  if (access.kind === "bypass") {
    const member = access.member;
    await syncMemberContact(member, {
      firstName: input.initiatorName,
      phone: canonicalPhone,
      email: input.initiatorEmail,
      smsConsent: input.initiatorSmsConsent,
    });

    const allowance = await getMemberAllowance(member);
    if (allowance.limitReached) {
      return NextResponse.json(
        {
          allowanceReached: true,
          isTrial: allowance.isTrial,
          allowanceLimit: allowance.limit,
          resetDate: formatResetDate(allowance.resetDate),
        },
        { status: 200 },
      );
    }

    const inviteToken = generateToken();
    const { data: run, error } = await supabase
      .from("runs")
      .insert({
        ...runBase,
        invite_token: inviteToken,
        member_id: member.id,
        status: "ready",
        reward_status: "none",
      })
      .select("invite_token")
      .single();

    if (error || !run) {
      console.error("[checkout] run insert (bypass) failed:", error?.message);
      return NextResponse.json(
        { error: "Run could not be saved. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ shareToken: run.invite_token }, { status: 200 });
  }

  // --- Behavior-test mode: skip Stripe for one card-free plan. -------------
  // Only reached when the phone has no active/trialing membership (Path A above
  // still bypasses real paid members normally). Never contacts Stripe, never
  // invents Stripe IDs, never marks the member active/trialing. Records are
  // flagged is_behavior_test (best-effort until migration 0006 is applied).
  if (isBehaviorTestMode()) {
    return handleBehaviorTestCheckout({
      supabase,
      input,
      canonicalPhone,
      runBase,
      existingMember: access.member,
    });
  }

  // --- Path B: no valid membership → reuse phone-matched member or create one ---
  let member = access.member;

  if (member) {
    await syncMemberContact(member, {
      firstName: input.initiatorName,
      phone: canonicalPhone,
      email: input.initiatorEmail,
      smsConsent: input.initiatorSmsConsent,
    });
  } else {
    const { data: created, error: memberError } = await supabase
      .from("members")
      .insert({
        first_name: input.initiatorName,
        phone: canonicalPhone,
        email: input.initiatorEmail,
        sms_consent: input.initiatorSmsConsent,
        subscription_status: "inactive",
        member_access_token: generateToken(),
      })
      .select("*")
      .single();

    if (memberError || !created) {
      console.error("[checkout] member insert failed:", memberError?.message);
      return NextResponse.json(
        { error: "We couldn't start your membership. Please try again." },
        { status: 500 },
      );
    }
    member = created as MemberRow;
  }

  const inviteToken = generateToken();
  const { data: run, error: runError } = await supabase
    .from("runs")
    .insert({
      ...runBase,
      invite_token: inviteToken,
      member_id: member.id,
      status: "awaiting_payment",
      reward_status: "none",
    })
    .select("id")
    .single();

  if (runError || !run) {
    console.error("[checkout] run insert (checkout) failed:", runError?.message);
    return NextResponse.json(
      { error: "Run could not be saved. Please try again." },
      { status: 500 },
    );
  }

  const stripe = getStripe();
  const existingCustomerId = member.stripe_customer_id ?? undefined;
  // Do not silently grant a second free trial to returning / prior customers.
  const offerTrial = shouldOfferCheckoutTrial(member);

  let origin: string;
  try {
    origin = resolveSiteUrl(request);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Could not resolve a public site URL for Checkout redirects.";
    console.error("[checkout] origin resolution failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (isDev) {
    console.log(`[checkout] resolved origin: ${origin}`);
  }

  try {
    if (existingCustomerId) {
      await stripe.customers.update(existingCustomerId, {
        email: input.initiatorEmail,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: serverEnv.stripePriceId(), quantity: 1 }],
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : { customer_email: input.initiatorEmail }),
      client_reference_id: member.id,
      metadata: { run_id: run.id, member_id: member.id },
      payment_method_collection: "always",
      subscription_data: {
        ...(offerTrial
          ? {
              trial_period_days: rewardConfig.trialDays,
              trial_settings: {
                end_behavior: { missing_payment_method: "cancel" },
              },
            }
          : {}),
        metadata: { run_id: run.id, member_id: member.id },
      },
      success_url: `${origin}/api/stripe/verify?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/create?canceled=1`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe Checkout could not be created." },
        { status: 500 },
      );
    }

    return NextResponse.json({ checkoutUrl: session.url }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Stripe Checkout could not be created.";
    console.error("[checkout] Stripe session failed:", message);
    return NextResponse.json(
      {
        error: isDev
          ? `Stripe Checkout could not be created: ${message}`
          : "Stripe Checkout could not be created.",
      },
      { status: 500 },
    );
  }
}

/**
 * Behavior-test checkout: create (or reuse) a member and a ready-to-share run
 * without any Stripe involvement, then hand back the share token so the client
 * continues into the normal invite/accept flow. Enforces a single card-free
 * plan per behavior-test member.
 */
async function handleBehaviorTestCheckout(args: {
  supabase: SupabaseAdmin;
  input: {
    initiatorName: string;
    initiatorEmail: string;
    initiatorSmsConsent: boolean;
  };
  canonicalPhone: string;
  runBase: Record<string, unknown>;
  existingMember: MemberRow | null;
}): Promise<NextResponse> {
  const { supabase, input, canonicalPhone, runBase, existingMember } = args;

  let member = existingMember;
  if (member) {
    // Reuse the phone-matched member; keep contact details fresh. We do NOT
    // flip an existing (possibly real) member's is_behavior_test flag.
    await syncMemberContact(member, {
      firstName: input.initiatorName,
      phone: canonicalPhone,
      email: input.initiatorEmail,
      smsConsent: input.initiatorSmsConsent,
    });
  } else {
    member = await insertRowWithBehaviorTestFlag<MemberRow>(supabase, "members", {
      first_name: input.initiatorName,
      phone: canonicalPhone,
      email: input.initiatorEmail,
      sms_consent: input.initiatorSmsConsent,
      subscription_status: "inactive",
      member_access_token: generateToken(),
    });
    if (!member) {
      return NextResponse.json(
        { error: "We couldn't start your behavior-test plan. Please try again." },
        { status: 500 },
      );
    }
  }

  const usedPlans = await countBehaviorTestPlans(supabase, member.id);
  if (usedPlans >= BEHAVIOR_TEST_PLAN_LIMIT) {
    return NextResponse.json(
      {
        allowanceReached: true,
        behaviorTest: true,
        allowanceLimit: BEHAVIOR_TEST_PLAN_LIMIT,
      },
      { status: 200 },
    );
  }

  const run = await insertRowWithBehaviorTestFlag<{ invite_token: string }>(
    supabase,
    "runs",
    {
      ...runBase,
      invite_token: generateToken(),
      member_id: member.id,
      status: "ready",
      reward_status: "none",
    },
    "invite_token",
  );

  if (!run) {
    return NextResponse.json(
      { error: "Run could not be saved. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { shareToken: run.invite_token, behaviorTest: true },
    { status: 200 },
  );
}

/**
 * Insert a row with `is_behavior_test = true`. If migration 0006 has not been
 * applied yet, retry without the flag so the flow still works (the row simply
 * won't be durably marked until the column exists).
 */
async function insertRowWithBehaviorTestFlag<T>(
  supabase: SupabaseAdmin,
  table: "members" | "runs",
  baseRow: Record<string, unknown>,
  select = "*",
): Promise<T | null> {
  let result = await supabase
    .from(table)
    .insert({ ...baseRow, is_behavior_test: true })
    .select(select)
    .single();

  if (result.error && isMissingBehaviorTestColumnError(result.error)) {
    console.warn(
      `[checkout] '${table}.is_behavior_test' is missing — apply migration 0006 to durably flag behavior-test records. Inserting without the flag for now.`,
    );
    result = await supabase
      .from(table)
      .insert(baseRow)
      .select(select)
      .single();
  }

  if (result.error || !result.data) {
    console.error(
      `[checkout] behavior-test ${table} insert failed:`,
      result.error?.message,
    );
    return null;
  }

  return result.data as T;
}

/** Count a behavior-test member's created plans (for the one-plan cap). */
async function countBehaviorTestPlans(
  supabase: SupabaseAdmin,
  memberId: string,
): Promise<number> {
  const statuses = [...BEHAVIOR_TEST_CONSUMED_STATUSES];

  // NB: no `head: true`. A HEAD request returns an empty error body, so the
  // missing-column error can't be detected before migration 0006 is applied.
  let result = await supabase
    .from("runs")
    .select("id", { count: "exact" })
    .eq("member_id", memberId)
    .in("status", statuses)
    .eq("is_behavior_test", true);

  if (result.error && isMissingBehaviorTestColumnError(result.error)) {
    // Pre-migration fallback: this member was created in behavior-test mode,
    // so any of their ready+ runs are behavior-test plans.
    result = await supabase
      .from("runs")
      .select("id", { count: "exact" })
      .eq("member_id", memberId)
      .in("status", statuses);
  }

  if (result.error) {
    console.error(
      "[checkout] behavior-test plan count failed:",
      result.error.message,
    );
    return 0;
  }

  return result.count ?? 0;
}

async function syncMemberContact(
  member: MemberRow,
  args: {
    firstName: string;
    phone: string;
    email: string;
    smsConsent: boolean;
  },
): Promise<void> {
  const emailDecision = resolveEmailUpdate({
    existingEmail: member.email,
    submittedEmail: args.email,
  });

  if (emailDecision.mismatched) {
    console.warn(
      `[checkout] email mismatch for member ${member.id} (phone ${args.phone}): stored=${member.email} submitted=${args.email}. Updating to submitted email because phone matched.`,
    );
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("members")
    .update({
      first_name: args.firstName,
      phone: args.phone,
      email: emailDecision.email,
      sms_consent: args.smsConsent,
    })
    .eq("id", member.id);

  if (error) {
    console.error("[checkout] member contact sync failed:", error.message);
  }
}
