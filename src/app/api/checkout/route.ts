import { NextResponse } from "next/server";
import { createRunSchema } from "@/lib/schemas";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { serverEnv, siteUrl } from "@/lib/env";
import { generateToken } from "@/lib/tokens";
import { getMemberFromCookie } from "@/lib/auth";
import {
  isMembershipActive,
  getMemberAllowance,
  formatResetDate,
} from "@/lib/reward-period";
import { rewardConfig } from "@/config/reward";
import type { TimeWindow } from "@/lib/types";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = createRunSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Please check the plan details and try again.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  const input = parsed.data;
  const supabase = getSupabaseAdmin();

  const timeOne: TimeWindow = input.timeOptionOne;
  const timeTwo: TimeWindow | null = input.timeOptionTwo ?? null;

  const runBase = {
    initiator_name: input.initiatorName,
    initiator_phone: input.initiatorPhone,
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

  const existingMember = await getMemberFromCookie();

  // --- Path A: active member returning with a valid membership cookie ---
  if (existingMember && isMembershipActive(existingMember)) {
    const allowance = await getMemberAllowance(existingMember);
    if (allowance.limitReached) {
      return NextResponse.json(
        {
          allowanceReached: true,
          isTrial: allowance.isTrial,
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
        member_id: existingMember.id,
        status: "ready",
        reward_status: "none",
      })
      .select("invite_token")
      .single();

    if (error || !run) {
      return NextResponse.json(
        { error: "We couldn't create your run. Please try again." },
        { status: 500 },
      );
    }

    // Keep the member's contact details fresh.
    await supabase
      .from("members")
      .update({
        first_name: input.initiatorName,
        phone: input.initiatorPhone,
        email: input.initiatorEmail,
        sms_consent: input.initiatorSmsConsent,
      })
      .eq("id", existingMember.id);

    return NextResponse.json({ shareToken: run.invite_token }, { status: 200 });
  }

  // --- Path B: new or lapsed member -> Stripe Checkout ---
  let memberId = existingMember?.id ?? null;

  if (memberId) {
    await supabase
      .from("members")
      .update({
        first_name: input.initiatorName,
        phone: input.initiatorPhone,
        email: input.initiatorEmail,
        sms_consent: input.initiatorSmsConsent,
      })
      .eq("id", memberId);
  } else {
    const { data: member, error: memberError } = await supabase
      .from("members")
      .insert({
        first_name: input.initiatorName,
        phone: input.initiatorPhone,
        email: input.initiatorEmail,
        sms_consent: input.initiatorSmsConsent,
        subscription_status: "inactive",
        member_access_token: generateToken(),
      })
      .select("id")
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: "We couldn't start your membership. Please try again." },
        { status: 500 },
      );
    }
    memberId = member.id;
  }

  const inviteToken = generateToken();
  const { data: run, error: runError } = await supabase
    .from("runs")
    .insert({
      ...runBase,
      invite_token: inviteToken,
      member_id: memberId,
      status: "awaiting_payment",
      reward_status: "none",
    })
    .select("id")
    .single();

  if (runError || !run) {
    return NextResponse.json(
      { error: "We couldn't create your run. Please try again." },
      { status: 500 },
    );
  }

  const stripe = getStripe();
  const existingCustomerId = existingMember?.stripe_customer_id ?? undefined;

  try {
    // Keep the Stripe Customer email aligned with checkout so the hosted
    // customer portal can find the member by the email they just used.
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
      client_reference_id: memberId ?? undefined,
      metadata: { run_id: run.id, member_id: memberId ?? "" },
      // Require the card during the free trial, but never charge at checkout.
      payment_method_collection: "always",
      subscription_data: {
        trial_period_days: rewardConfig.trialDays,
        trial_settings: {
          end_behavior: { missing_payment_method: "cancel" },
        },
        metadata: { run_id: run.id, member_id: memberId ?? "" },
      },
      success_url: `${siteUrl()}/api/stripe/verify?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/create?canceled=1`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 },
      );
    }

    return NextResponse.json({ checkoutUrl: session.url }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Stripe checkout could not be started.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
