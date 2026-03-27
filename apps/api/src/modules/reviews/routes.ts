import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { verifyTokenOrReply } from "../../lib/auth";
import { createNotification } from "../../lib/notifications";
import { prisma } from "../../lib/prisma";

const db = prisma as unknown as {
  review: {
    findMany: (args: unknown) => Promise<any[]>;
    findUnique: (args: unknown) => Promise<any>;
    findFirst: (args: unknown) => Promise<any>;
    create: (args: unknown) => Promise<any>;
    aggregate: (args: unknown) => Promise<any>;
    count: (args: unknown) => Promise<number>;
  };
  booking: {
    findUnique: (args: unknown) => Promise<any>;
  };
};

const createReviewSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

export async function reviewRoutes(server: FastifyInstance) {
  // Get reviews for a listing (public)
  server.get("/listings/:id/reviews", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { page?: string; limit?: string };
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const [reviews, total, agg] = await Promise.all([
      db.review.findMany({
        where: { listingId: id },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          author: { select: { id: true, name: true } },
        },
      }),
      db.review.count({ where: { listingId: id } }),
      db.review.aggregate({
        where: { listingId: id },
        _avg: { rating: true },
      }),
    ]);

    return reply.send({
      reviews,
      avgRating: agg._avg?.rating ? Number(agg._avg.rating.toFixed(1)) : null,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // Create a review (authenticated, must have a confirmed booking)
  server.post("/reviews", async (request, reply) => {
    const auth = verifyTokenOrReply(request, reply);
    if (!auth) return;

    const parsed = createReviewSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid request body",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { bookingId, rating, comment } = parsed.data;

    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        guestId: true,
        listingId: true,
        status: true,
        checkOut: true,
        listing: {
          select: {
            title: true,
            hostId: true,
          },
        },
      },
    });

    if (!booking) {
      return reply.code(404).send({ message: "Booking not found" });
    }

    if (booking.guestId !== auth.sub) {
      return reply.code(403).send({ message: "You can only review your own bookings" });
    }

    if (booking.status !== "CONFIRMED") {
      return reply.code(400).send({ message: "Can only review confirmed bookings" });
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (new Date(booking.checkOut) > now) {
      return reply.code(400).send({ message: "Can only review after check-out date" });
    }

    const existing = await db.review.findFirst({
      where: { bookingId },
    });

    if (existing) {
      return reply.code(409).send({ message: "You already reviewed this booking" });
    }

    const review = await db.review.create({
      data: {
        rating,
        comment: comment ?? null,
        authorId: auth.sub,
        listingId: booking.listingId,
        bookingId,
      },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        listing: { select: { id: true, title: true } },
      },
    });

    await createNotification({
      body: `You received a ${rating}-star review for ${booking.listing.title}.`,
      link: `/listings/${booking.listingId}`,
      title: "New review received",
      type: "REVIEW_RECEIVED",
      userId: booking.listing.hostId,
    });

    return reply.code(201).send({ review });
  });

  // Get my reviews (authenticated)
  server.get("/my/reviews", async (request, reply) => {
    const auth = verifyTokenOrReply(request, reply);
    if (!auth) return;

    const reviews = await db.review.findMany({
      where: { authorId: auth.sub },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        listing: { select: { id: true, title: true } },
      },
    });

    return reply.send({ reviews });
  });
}
