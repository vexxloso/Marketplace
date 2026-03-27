import Stripe from "stripe";

import { env } from "../env";

let stripeClient: Stripe | null | undefined;

export function getStripeClient() {
  if (!env.STRIPE_SECRET_KEY) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
}
