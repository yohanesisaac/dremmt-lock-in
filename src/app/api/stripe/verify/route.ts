import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveSiteUrl } from "@/lib/env";
import { MEMBER_COOKIE, memberCookieOptions } from "@/lib/auth";
import { buildSubscriptionSyncPatch } from "@/lib/stripe-webhook-sync";
import {
  VERIFY_RUN_READY_STATUSES,
  buildStripeVerifyRedirect,
} from "@/lib/stripe-verify-redirect";

/**
 * Stripe success_url target. Verifies the Checkout Session server-side, marks
 * membership active + run ready, sets the secure membership cookie, then
 * redirects into the share page. The webhook remains the authoritative source
 * of subscription state; this exists so local testing has a smooth flow.
 *
 * Cancellation fields are written from the live Stripe Subscription via the
 * shared normalizer — never invent cancel_at_period_end=false or clear
 * access_ends_at without Stripe saying so.
 *
 * Reloading this URL is idempotent: runs already `ready` are re-selected, and
 * no duplicate members / subscriptions / allowance usage are created.
 */
export async function GET(request: NextRequest) {
  let origin: string;
  try {
    origin = resolveSiteUrl(request);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Could not resolve a public site URL for redirects.";
    console.error("[stripe/verify] origin resolution failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");

  console.log(`[stripe/verify] resolved origin: ${origin}`);
  if (sessionId) {
    console.log(`[stripe/verify] session_id: ${sessionId}`);
  }

  const failureRedirect = buildStripeVerifyRedirect(origin, { error: true });
  const failure = NextResponse.redirect(failureRedirect.url);

  if (!sessionId) {
    console.log(`[stripe/verify] redirect: ${failureRedirect.pathname}`);
    return failure;
  }

  const stripe = getStripe();

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    console.log(`[stripe/verify] redirect: ${failureRedirect.pathname}`);
    return failure;
  }

  // Trial checkouts often complete with payment_status "no_payment_required".
  const checkoutOk =
    session.status === "complete" ||
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required";
  if (!checkoutOk) {
    console.log(`[stripe/verify] redirect: ${failureRedirect.pathname}`);
    return failure;
  }

  const memberId = session.metadata?.member_id;
  const runId = session.metadata?.run_id;
  const customerId =
    typeof session.customer === "string" ? session.customer : null;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : null;

  const supabase = getSupabaseAdmin();

  if (memberId && subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const patch = buildSubscriptionSyncPatch(subscription);
      await supabase
        .from("members")
        .update({
          stripe_customer_id: patch.stripe_customer_id ?? customerId,
          stripe_subscription_id: patch.stripe_subscription_id,
          subscription_status: patch.subscription_status,
          cancel_at_period_end: patch.cancel_at_period_end,
          cancellation_requested_at: patch.cancellation_requested_at,
          access_ends_at: patch.access_ends_at,
        })
        .eq("id", memberId);
    } catch {
      /* webhook will reconcile */
      if (customerId || subscriptionId) {
        await supabase
          .from("members")
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          })
          .eq("id", memberId);
      }
    }
  } else if (memberId) {
    await supabase
      .from("members")
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
      })
      .eq("id", memberId);
  }

  let inviteToken: string | null = null;
  if (runId) {
    const { data } = await supabase
      .from("runs")
      .update({ status: "ready" })
      .eq("id", runId)
      .in("status", [...VERIFY_RUN_READY_STATUSES])
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

  if (!inviteToken) {
    console.log(`[stripe/verify] redirect: ${failureRedirect.pathname}`);
    return failure;
  }

  let memberAccessToken: string | null = null;
  if (memberId) {
    const { data: member } = await supabase
      .from("members")
      .select("member_access_token")
      .eq("id", memberId)
      .maybeSingle();
    memberAccessToken = member?.member_access_token ?? null;
  }

  const successRedirect = buildStripeVerifyRedirect(origin, { inviteToken });
  console.log(`[stripe/verify] redirect: ${successRedirect.pathname}`);

  const response = NextResponse.redirect(successRedirect.url);

  if (memberAccessToken) {
    response.cookies.set(MEMBER_COOKIE, memberAccessToken, memberCookieOptions());
  }

  return response;
}
