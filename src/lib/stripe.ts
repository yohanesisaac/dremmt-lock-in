import Stripe from "stripe";
import { serverEnv } from "./env";

let cached: Stripe | null = null;

/** Server-only Stripe client. Never expose the secret key to the browser. */
export function getStripe(): Stripe {
  if (cached) return cached;
  cached = new Stripe(serverEnv.stripeSecretKey());
  return cached;
}
