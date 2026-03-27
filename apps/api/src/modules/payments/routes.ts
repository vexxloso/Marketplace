import type { FastifyInstance, FastifyRequest } from "fastify";
import Stripe from "stripe";
import { z } from "zod";

import { env } from "../../env";
import { verifyTokenOrReply } from "../../lib/auth";
import { getStripeClient } from "../../lib/stripe";
import { prisma } from "../../lib/prisma";

const createCheckoutSchema = z.object({
  bookingId: z.string().min(1),
});

const db = prisma as unknown as {
  booking: {
    findUnique: (args: unknown) => Promise<any>;
  };
  payment: {
    create: (args: unknown) => Promise<any>;
    findUnique: (args: unknown) => Promise<any>;
    update: (args: unknown) => Promise<any>;
  };
};

function toAmountInCents(amount: string | number) {
  return Math.round(Number(amount) * 100);
}

export async function paymentRoutes(server: FastifyInstance) {
  server.post("/payments/checkout-session", async (request, reply) => {
    const auth = verifyTokenOrReply(request, reply);
    if (!auth) return;

    const parsed = createCheckoutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid request body",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return reply.code(503).send({
        message: "Stripe is not configured yet. Add STRIPE_SECRET_KEY first.",
      });
    }

    const booking = await db.booking.findUnique({
      where: { id: parsed.data.bookingId },
      select: {
        guestId: true,
        id: true,
        payment: {
          select: {
            id: true,
            status: true,
            stripeCheckoutSessionId: true,
          },
        },
        status: true,
        totalPrice: true,
        listing: { select: { id: true, title: true } },
      },
    });

    if (!booking) {
      return reply.code(404).send({ message: "Booking not found" });
    }

    if (booking.guestId !== auth.sub) {
      return reply.code(403).send({ message: "Not authorized" });
    }

    if (booking.status === "CANCELLED") {
      return reply.code(400).send({ message: "Cancelled bookings cannot be paid" });
    }

    if (booking.payment?.status === "PAID") {
      return reply.code(400).send({ message: "Booking already paid" });
    }

    const amountTotal = Number(booking.totalPrice);
    const session = await stripe.checkout.sessions.create({
      cancel_url: `${env.APP_URL}/payment/cancel?bookingId=${booking.id}`,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Booking for ${booking.listing.title}`,
            },
            unit_amount: toAmountInCents(amountTotal),
          },
          quantity: 1,
        },
      ],
      metadata: {
        bookingId: booking.id,
        guestId: auth.sub,
        listingId: booking.listing.id,
      },
      mode: "payment",
      success_url: `${env.APP_URL}/payment/success?bookingId=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
    });

    if (booking.payment) {
      await db.payment.update({
        where: { id: booking.payment.id },
        data: {
          amountTotal,
          status: "PENDING",
          stripeCheckoutSessionId: session.id,
        },
      });
    } else {
      await db.payment.create({
        data: {
          amountTotal,
          bookingId: booking.id,
          guestId: auth.sub,
          status: "PENDING",
          stripeCheckoutSessionId: session.id,
        },
      });
    }

    return reply.send({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  });

  server.post(
    "/payments/webhook",
    {
      config: {
        rawBody: true,
      },
    },
    async (request, reply) => {
      const stripe = getStripeClient();
      if (!stripe) {
        return reply.code(503).send({ message: "Stripe is not configured" });
      }

      let event: Stripe.Event;

      try {
        const rawRequest = request as FastifyRequest & {
          rawBody?: string | Buffer;
        };

        if (env.STRIPE_WEBHOOK_SECRET) {
          const signature = request.headers["stripe-signature"];
          if (typeof signature !== "string" || !rawRequest.rawBody) {
            return reply.code(400).send({ message: "Missing Stripe signature" });
          }

          event = stripe.webhooks.constructEvent(
            rawRequest.rawBody,
            signature,
            env.STRIPE_WEBHOOK_SECRET,
          );
        } else {
          event = request.body as Stripe.Event;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Webhook signature verification failed";
        return reply.code(400).send({ message });
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.bookingId;

        if (bookingId) {
          const payment = await db.payment.findUnique({
            where: { bookingId },
            select: { id: true },
          });

          if (payment) {
            await db.payment.update({
              where: { id: payment.id },
              data: {
                status: "PAID",
                stripeCheckoutSessionId: session.id,
              },
            });
          }
        }
      }

      if (event.type === "checkout.session.expired") {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.bookingId;

        if (bookingId) {
          const payment = await db.payment.findUnique({
            where: { bookingId },
            select: { id: true },
          });

          if (payment) {
            await db.payment.update({
              where: { id: payment.id },
              data: {
                status: "FAILED",
                stripeCheckoutSessionId: session.id,
              },
            });
          }
        }
      }

      return reply.send({ received: true });
    },
  );
}
