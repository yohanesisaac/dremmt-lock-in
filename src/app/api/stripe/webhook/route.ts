import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase";
import { serverEnv } from "@/lib/env";
import type { SubscriptionStatus } from "@/lib/types";

function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "unpaid":
      return "unpaid";
    case "canceled":
      return "canceled";
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    default:
      return "inactive";
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const body = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      serverEnv.stripeWebhookSecret(),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature.";
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const memberId = session.metadata?.member_id;
        const runId = session.metadata?.run_id;
        const customerId =
          typeof session.customer === "string" ? session.customer : null;
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : null;

        let status: SubscriptionStatus = "active";
        let cancelAtPeriodEnd = false;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          status = mapStatus(subscription.status);
          cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;
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

        if (runId) {
          // Move the paid run out of awaiting_payment so it is ready to share.
          await supabase
            .from("runs")
            .update({ status: "ready" })
            .eq("id", runId)
            .eq("status", "awaiting_payment");
        }
        break;
      }

      case "customer.subscription.updated": {
        // Covers trialing -> active, active -> past_due, and a scheduled
        // end-of-period cancellation (status stays active/trialing while
        // cancel_at_period_end flips to true; access continues until the
        // period ends and a deleted event arrives).
        const subscription = event.data.object as Stripe.Subscription;
        await supabase
          .from("members")
          .update({
            subscription_status: mapStatus(subscription.status),
            cancel_at_period_end: subscription.cancel_at_period_end ?? false,
          })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await supabase
          .from("members")
          .update({
            subscription_status: "canceled",
            cancel_at_period_end: false,
          })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | null;
        };
        const subscriptionId =
          typeof invoice.subscription === "string" ? invoice.subscription : null;
        if (subscriptionId) {
          await supabase
            .from("members")
            .update({ subscription_status: "past_due" })
            .eq("stripe_subscription_id", subscriptionId);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
