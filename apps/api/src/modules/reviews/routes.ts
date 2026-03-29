import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { verifyTokenOrReply } from "../../lib/auth.js";
import { createNotification } from "../../lib/notifications.js";
import { prisma } from "../../lib/prisma.js";

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
  listing: {
    findUnique: (args: unknown) => Promise<any>;
  };
};

const createReviewSchema = z.object({
  listingId: z.string().min(1),
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

  // Create a review (authenticated; listing id in body — no booking id required)
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

    const { listingId, rating, comment } = parsed.data;

    const listing = await db.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        title: true,
        hostId: true,
        status: true,
      },
    });

    if (!listing) {
      return reply.code(404).send({ message: "Listing not found" });
    }

    if (listing.status !== "PUBLISHED") {
      return reply.code(400).send({ message: "Reviews are only allowed on published listings" });
    }

    if (listing.hostId === auth.sub) {
      return reply.code(403).send({ message: "You cannot review your own listing" });
    }

    const existing = await db.review.findFirst({
      where: { authorId: auth.sub, listingId },
    });

    if (existing) {
      return reply.code(409).send({ message: "You already reviewed this listing" });
    }

    const review = await db.review.create({
      data: {
        rating,
        comment: comment ?? null,
        authorId: auth.sub,
        listingId,
        bookingId: null,
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
      body: `You received a ${rating}-star review for ${listing.title}.`,
      link: `/listings/${listingId}`,
      title: "New review received",
      type: "REVIEW_RECEIVED",
      userId: listing.hostId,
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
