import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase";
import { siteUrl } from "@/lib/env";
import { MEMBER_COOKIE, memberCookieOptions } from "@/lib/auth";
import type { SubscriptionStatus } from "@/lib/types";

/**
 * Stripe success_url target. Verifies the Checkout Session server-side, marks
 * membership active + run ready, sets the secure membership cookie, then
 * redirects into the share page. The webhook remains the authoritative source
 * of subscription state; this exists so local testing has a smooth flow.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  const failure = NextResponse.redirect(`${siteUrl()}/checkout/success?error=1`);

  if (!sessionId) return failure;

  const stripe = getStripe();

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return failure;
  }

  // Trial checkouts often complete with payment_status "no_payment_required".
  const checkoutOk =
    session.status === "complete" ||
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required";
  if (!checkoutOk) return failure;

  const memberId = session.metadata?.member_id;
  const runId = session.metadata?.run_id;
  const customerId =
    typeof session.customer === "string" ? session.customer : null;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : null;

  const supabase = getSupabaseAdmin();

  let status: SubscriptionStatus = "active";
  let cancelAtPeriodEnd = false;
  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      if (subscription.status === "trialing") status = "trialing";
      else if (subscription.status === "active") status = "active";
      else if (subscription.status === "past_due") status = "past_due";
      else if (subscription.status === "canceled") status = "canceled";
      cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;
    } catch {
      /* keep default active — webhook will reconcile */
    }
  }

  if (memberId) {
    await supabase
      .from("members")
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        subscription_status: status,
        cancel_at_period_end: cancelAtPeriodEnd,
      })
      .eq("id", memberId);
  }

  let inviteToken: string | null = null;
  if (runId) {
    const { data } = await supabase
      .from("runs")
      .update({ status: "ready" })
      .eq("id", runId)
      .in("status", ["awaiting_payment", "ready"])
      .select("invite_token")
      .maybeSingle();
    inviteToken = data?.invite_token ?? null;

    if (!inviteToken) {
      const { data: existing } = await supabase
        .from("runs")
        .select("invite_token")
        .eq("id", runId)
        .maybeSingle();
      inviteToken = existing?.invite_token ?? null;
    }
  }

  if (!inviteToken) return failure;

  // Retrieve the member access token so we can set the secure cookie.
  let memberAccessToken: string | null = null;
  if (memberId) {
    const { data: member } = await supabase
      .from("members")
      .select("member_access_token")
      .eq("id", memberId)
      .maybeSingle();
    memberAccessToken = member?.member_access_token ?? null;
  }

  const response = NextResponse.redirect(
    `${siteUrl()}/checkout/success?token=${inviteToken}`,
  );

  if (memberAccessToken) {
    response.cookies.set(MEMBER_COOKIE, memberAccessToken, memberCookieOptions());
  }

  return response;
}
