import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase";
import { serverEnv } from "@/lib/env";
import type { MemberRow } from "@/lib/types";
import {
  buildSubscriptionSyncPatch,
  syncSubscriptionCancellation,
  type SubscriptionSyncPatch,
} from "@/lib/stripe-webhook-sync";

async function findMemberBySubscriptionId(
  subscriptionId: string,
): Promise<MemberRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("stripe_subscription_id", subscriptionId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Member lookup by subscription failed: ${error.message}`);
  }
  return (data as MemberRow | null) ?? null;
}

async function findMemberByCustomerId(
  customerId: string,
): Promise<MemberRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("stripe_customer_id", customerId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Member lookup by customer failed: ${error.message}`);
  }
  return (data as MemberRow | null) ?? null;
}

async function updateMemberById(
  memberId: string,
  patch: SubscriptionSyncPatch,
): Promise<MemberRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("members")
    .update({
      subscription_status: patch.subscription_status,
      cancel_at_period_end: patch.cancel_at_period_end,
      cancellation_requested_at: patch.cancellation_requested_at,
      access_ends_at: patch.access_ends_at,
      stripe_subscription_id: patch.stripe_subscription_id,
      ...(patch.stripe_customer_id
        ? { stripe_customer_id: patch.stripe_customer_id }
        : {}),
    })
    .eq("id", memberId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Member update failed: ${error.message}`);
  }
  return (data as MemberRow | null) ?? null;
}

function logDevWarning(message: string) {
  console.warn(message);
}

async function handleSubscriptionLifecycle(
  subscription: Stripe.Subscription,
  options?: { asDeleted?: boolean },
): Promise<NextResponse | null> {
  const result = await syncSubscriptionCancellation({
    subscription,
    findBySubscriptionId: findMemberBySubscriptionId,
    findByCustomerId: findMemberByCustomerId,
    updateMemberById,
    logWarning: logDevWarning,
    asDeleted: options?.asDeleted,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return null;
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

        // Pull live subscription so we never invent cancel_at_period_end=false
        // over a newer cancellation state Stripe already has.
        let patch: SubscriptionSyncPatch | null = null;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          patch = buildSubscriptionSyncPatch(subscription);
          if (customerId && !patch.stripe_customer_id) {
            patch.stripe_customer_id = customerId;
          }
        }

        if (memberId) {
          const { data, error } = await supabase
            .from("members")
            .update(
              patch
                ? {
                    stripe_customer_id: patch.stripe_customer_id ?? customerId,
                    stripe_subscription_id: patch.stripe_subscription_id,
                    subscription_status: patch.subscription_status,
                    cancel_at_period_end: patch.cancel_at_period_end,
                    cancellation_requested_at: patch.cancellation_requested_at,
                    access_ends_at: patch.access_ends_at,
                  }
                : {
                    stripe_customer_id: customerId,
                    stripe_subscription_id: subscriptionId,
                  },
            )
            .eq("id", memberId)
            .select("id")
            .maybeSingle();
          if (error) {
            throw new Error(
              `checkout.session.completed member update failed: ${error.message}`,
            );
          }
          if (!data) {
            throw new Error(
              `checkout.session.completed matched zero members for id ${memberId}.`,
            );
          }
        }

        if (runId) {
          const { error } = await supabase
            .from("runs")
            .update({ status: "ready" })
            .eq("id", runId)
            .eq("status", "awaiting_payment");
          if (error) {
            throw new Error(
              `checkout.session.completed run update failed: ${error.message}`,
            );
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const failure = await handleSubscriptionLifecycle(subscription);
        if (failure) return failure;
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const failure = await handleSubscriptionLifecycle(subscription, {
          asDeleted: true,
        });
        if (failure) return failure;
        break;
      }

      case "invoice.payment_failed": {
        // Only touch subscription_status. Do not reset cancellation fields.
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | null;
        };
        const subscriptionId =
          typeof invoice.subscription === "string" ? invoice.subscription : null;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : null;

        const member =
          (subscriptionId
            ? await findMemberBySubscriptionId(subscriptionId)
            : null) ??
          (customerId ? await findMemberByCustomerId(customerId) : null);

        if (!member) {
          logDevWarning(
            `[stripe webhook] invoice.payment_failed: no member for subscription=${subscriptionId} customer=${customerId}`,
          );
          break;
        }

        const { data, error } = await supabase
          .from("members")
          .update({ subscription_status: "past_due" })
          .eq("id", member.id)
          .select("id")
          .maybeSingle();

        if (error) {
          throw new Error(`invoice.payment_failed update failed: ${error.message}`);
        }
        if (!data) {
          throw new Error(
            `invoice.payment_failed matched zero members for id ${member.id}.`,
          );
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler failed.";
    console.error("[stripe webhook]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
