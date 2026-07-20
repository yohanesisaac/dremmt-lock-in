/**
 * Server-side environment access with clear, loud errors.
 *
 * Never import this from a Client Component. These reads are only valid on the
 * server (route handlers, server actions, server components).
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example and README_SETUP.md.`,
    );
  }
  return value;
}

export const serverEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseSecretKey: () => required("SUPABASE_SECRET_KEY"),
  stripeSecretKey: () => required("STRIPE_SECRET_KEY"),
  stripePriceId: () => required("STRIPE_PRICE_ID"),
  stripeWebhookSecret: () => required("STRIPE_WEBHOOK_SECRET"),
  adminPassword: () => required("ADMIN_PASSWORD"),
};

/** Public site URL. Falls back to localhost for local development. */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

/** The Dremmt pilot phone number (used for display + suggested copy). */
export function dremmtPhone(): string {
  return process.env.NEXT_PUBLIC_DREMMT_PHONE || "";
}

/**
 * Stripe's hosted (no-code) customer portal URL. Members open it and log in
 * with the email they checked out with — Stripe emails them a one-time code.
 * Not required for the app to run; the /manage-membership page degrades
 * gracefully when it is missing.
 */
export function stripeCustomerPortalUrl(): string {
  return process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL || "";
}
