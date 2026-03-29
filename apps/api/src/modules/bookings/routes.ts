import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireRoles, verifyTokenOrReply } from "../../lib/auth";
import { createNotification } from "../../lib/notifications";
import { calculateBookingQuote, daysBetween, parseDateOnly } from "../../lib/pricing";
import { prisma } from "../../lib/prisma";

const db = prisma as unknown as {
  booking: {
    findMany: (args: unknown) => Promise<any[]>;
    findUnique: (args: unknown) => Promise<any>;
    create: (args: unknown) => Promise<any>;
    update: (args: unknown) => Promise<any>;
    count: (args: unknown) => Promise<number>;
  };
  listing: {
    findUnique: (args: unknown) => Promise<any>;
  };
};

const createBookingSchema = z.object({
  listingId: z.string().min(1),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const stayQuerySchema = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const listingBookingSelect = {
  id: true,
  title: true,
  hostId: true,
  status: true,
  pricePerDay: true,
  weekendPrice: true,
  cleaningFee: true,
  minimumStayNights: true,
  instantBook: true,
  cancellationPolicy: true,
  lastMinuteDiscountPercent: true,
  weeklyDiscountPercent: true,
  seasonalRates: {
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      pricePerDay: true,
    },
  },
} as const;

async function countConflicts(listingId: string, checkIn: Date, checkOut: Date) {
  return db.booking.count({
    where: {
      listingId,
      status: { not: "CANCELLED" },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
  });
}

function validateStay(checkIn: Date, checkOut: Date, today: Date) {
  if (checkIn < today) {
    return "Check-in cannot be in the past";
  }
  if (checkOut <= checkIn) {
    return "Check-out must be after check-in";
  }

  const nights = daysBetween(checkIn, checkOut);
  if (nights < 1 || nights > 365) {
    return "Stay must be 1-365 nights";
  }

  return null;
}

export async function bookingRoutes(server: FastifyInstance) {
  // Check availability for a listing (public)
  server.get("/listings/:id/availability", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { checkIn?: string; checkOut?: string };

    const listing = await db.listing.findUnique({
      where: { id },
      select: { id: true, status: true, minimumStayNights: true },
    });

    if (!listing || listing.status !== "PUBLISHED") {
      return reply.code(404).send({ message: "Listing not found" });
    }

    if (!query.checkIn || !query.checkOut) {
      return reply.send({ available: true, message: "Provide checkIn & checkOut dates to check overlap" });
    }

    const parsed = stayQuerySchema.safeParse(query);
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid query parameters",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const checkIn = parseDateOnly(parsed.data.checkIn);
    const checkOut = parseDateOnly(parsed.data.checkOut);
    const today = parseDateOnly(new Date().toISOString().slice(0, 10));

    if (!checkIn || !checkOut || !today) {
      return reply.code(400).send({ message: "Invalid stay dates" });
    }

    const stayError = validateStay(checkIn, checkOut, today);
    if (stayError) {
      return reply.code(400).send({ message: stayError });
    }

    const nights = daysBetween(checkIn, checkOut);
    if (nights < listing.minimumStayNights) {
      return reply.send({
        available: false,
        message: `This listing requires at least ${listing.minimumStayNights} nights`,
        minimumStayNights: listing.minimumStayNights,
        nights,
      });
    }

    const conflict = await countConflicts(id, checkIn, checkOut);

    return reply.send({
      available: conflict === 0,
      minimumStayNights: listing.minimumStayNights,
      nights,
    });
  });

  server.get("/listings/:id/quote", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = stayQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid query parameters",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const checkIn = parseDateOnly(parsed.data.checkIn);
    const checkOut = parseDateOnly(parsed.data.checkOut);
    const today = parseDateOnly(new Date().toISOString().slice(0, 10));

    if (!checkIn || !checkOut || !today) {
      return reply.code(400).send({ message: "Invalid stay dates" });
    }

    const stayError = validateStay(checkIn, checkOut, today);
    if (stayError) {
      return reply.code(400).send({ message: stayError });
    }

    const listing = await db.listing.findUnique({
      where: { id },
      select: listingBookingSelect,
    });

    if (!listing || listing.status !== "PUBLISHED") {
      return reply.code(404).send({ message: "Listing not found" });
    }

    const quote = calculateBookingQuote({
      checkIn,
      checkOut,
      listing,
      today,
    });

    if (quote.nights < listing.minimumStayNights) {
      return reply.code(400).send({
        message: `This listing requires at least ${listing.minimumStayNights} nights`,
        minimumStayNights: listing.minimumStayNights,
      });
    }

    const conflict = await countConflicts(id, checkIn, checkOut);

    return reply.send({
      available: conflict === 0,
      bookingMode: listing.instantBook ? "INSTANT" : "REQUEST",
      cancellationPolicy: listing.cancellationPolicy,
      quote,
    });
  });

  // Create a booking (any authenticated user)
  server.post("/bookings", async (request, reply) => {
    const auth = verifyTokenOrReply(request, reply);
    if (!auth) return;

    const parsed = createBookingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid request body",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { listingId, checkIn: checkInStr, checkOut: checkOutStr } = parsed.data;
    const checkIn = parseDateOnly(checkInStr);
    const checkOut = parseDateOnly(checkOutStr);
    const today = parseDateOnly(new Date().toISOString().slice(0, 10));

    if (!checkIn || !checkOut || !today) {
      return reply.code(400).send({ message: "Invalid stay dates" });
    }

    const stayError = validateStay(checkIn, checkOut, today);
    if (stayError) {
      return reply.code(400).send({ message: stayError });
    }

    const listing = await db.listing.findUnique({
      where: { id: listingId },
      select: listingBookingSelect,
    });

    if (!listing || listing.status !== "PUBLISHED") {
      return reply.code(404).send({ message: "Listing not found or not available" });
    }

    if (listing.hostId === auth.sub) {
      return reply.code(400).send({ message: "You cannot book your own listing" });
    }

    const quote = calculateBookingQuote({
      checkIn,
      checkOut,
      listing,
      today,
    });

    if (quote.nights < listing.minimumStayNights) {
      return reply.code(400).send({
        message: `This listing requires at least ${listing.minimumStayNights} nights`,
      });
    }

    const conflict = await countConflicts(listingId, checkIn, checkOut);

    if (conflict > 0) {
      return reply.code(409).send({ message: "Dates not available" });
    }
    const nextStatus = listing.instantBook ? "CONFIRMED" : "PENDING";

    const booking = await db.booking.create({
      data: {
        checkIn,
        checkOut,
        totalPrice: quote.totalPrice,
        guestId: auth.sub,
        listingId,
        status: nextStatus,
      },
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        totalPrice: true,
        status: true,
        createdAt: true,
        payment: {
          select: { id: true, status: true },
        },
        listing: { select: { id: true, title: true } },
      },
    });

    if (listing.instantBook) {
      await Promise.all([
        createNotification({
          body: `${quote.nights} night stay booked instantly.`,
          link: "/dashboard",
          title: `Instant booking for ${listing.title}`,
          type: "BOOKING_CREATED",
          userId: listing.hostId,
        }),
        createNotification({
          body: `Your booking for ${listing.title} was confirmed instantly.`,
          link: "/dashboard",
          title: "Booking confirmed",
          type: "BOOKING_CONFIRMED",
          userId: auth.sub,
        }),
      ]);
    } else {
      await createNotification({
        body: `${quote.nights} night stay request from a guest.`,
        link: "/dashboard",
        title: `New booking for ${listing.title}`,
        type: "BOOKING_CREATED",
        userId: listing.hostId,
      });
    }

    return reply.code(201).send({ booking, nights: quote.nights, quote });
  });

  // List my bookings (as guest)
  server.get("/my/bookings", async (request, reply) => {
    const auth = verifyTokenOrReply(request, reply);
    if (!auth) return;

    const bookings = await db.booking.findMany({
      where: { guestId: auth.sub },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        totalPrice: true,
        status: true,
        createdAt: true,
        payment: {
          select: { id: true, status: true },
        },
        listing: {
          select: { id: true, title: true, pricePerDay: true },
        },
      },
    });

    return reply.send({ bookings });
  });

  // List bookings for my listings (as host)
  server.get("/my/listings/bookings", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const bookings = await db.booking.findMany({
      where: { listing: { hostId: auth.sub } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        totalPrice: true,
        status: true,
        createdAt: true,
        payment: {
          select: { id: true, status: true },
        },
        guest: { select: { id: true, name: true, email: true } },
        listing: { select: { id: true, title: true } },
      },
    });

    return reply.send({ bookings });
  });

  // Confirm a booking (host only)
  server.patch("/bookings/:id/confirm", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const booking = await db.booking.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        guestId: true,
        listing: { select: { hostId: true, title: true } },
      },
    });

    if (!booking) {
      return reply.code(404).send({ message: "Booking not found" });
    }
    if (booking.status !== "PENDING") {
      return reply.code(400).send({ message: `Cannot confirm a ${booking.status} booking` });
    }

    const updated = await db.booking.update({
      where: { id },
      data: { status: "CONFIRMED" },
      select: { id: true, status: true },
    });

    await createNotification({
      body: `Your booking for ${booking.listing.title} has been confirmed.`,
      link: "/dashboard",
      title: "Booking confirmed",
      type: "BOOKING_CONFIRMED",
      userId: booking.guestId,
    });

    return reply.send({ booking: updated });
  });

  // Cancel a booking (guest or host)
  server.patch("/bookings/:id/cancel", async (request, reply) => {
    const auth = verifyTokenOrReply(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const booking = await db.booking.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        guestId: true,
        listing: { select: { hostId: true, title: true } },
      },
    });

    if (!booking) {
      return reply.code(404).send({ message: "Booking not found" });
    }

    const isGuest = booking.guestId === auth.sub;
    const isAdmin = auth.role === "admin";

    if (!isGuest && !isAdmin) {
      return reply.code(403).send({ message: "Not authorized" });
    }

    if (booking.status === "CANCELLED") {
      return reply.code(400).send({ message: "Booking already cancelled" });
    }

    const updated = await db.booking.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: { id: true, status: true },
    });

    const notifyUserId = isGuest ? booking.listing.hostId : booking.guestId;
    await createNotification({
      body: `A booking for ${booking.listing.title} was cancelled.`,
      link: "/dashboard",
      title: "Booking cancelled",
      type: "BOOKING_CANCELLED",
      userId: notifyUserId,
    });

    return reply.send({ booking: updated });
  });
}
