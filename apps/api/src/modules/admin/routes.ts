import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireRoles, toAppRole, toDbRole } from "../../lib/auth";
import { prisma } from "../../lib/prisma";

const updateUserRoleSchema = z.object({
  role: z.enum(["guest", "host", "admin"]),
});

const updateUserModerationSchema = z.object({
  isBanned: z.boolean().optional(),
  isSuspended: z.boolean().optional(),
  isVerified: z.boolean().optional(),
});

const updateListingStatusSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  moderationNote: z.string().max(1000).nullable().optional(),
});

const updateReviewModerationSchema = z.object({
  moderationStatus: z.enum(["VISIBLE", "HIDDEN"]),
  moderationNote: z.string().max(1000).nullable().optional(),
});

const updatePlatformSettingsSchema = z.object({
  commissionRatePercent: z.number().min(0).max(100),
});

const db = prisma as unknown as {
  booking: {
    count: (args?: unknown) => Promise<number>;
    findMany: (args?: unknown) => Promise<any[]>;
  };
  listing: {
    count: (args?: unknown) => Promise<number>;
    findMany: (args?: unknown) => Promise<any[]>;
    findUnique: (args: unknown) => Promise<any>;
    update: (args: unknown) => Promise<any>;
  };
  payment: {
    count: (args?: unknown) => Promise<number>;
    findMany: (args?: unknown) => Promise<any[]>;
  };
  platformSetting: {
    findFirst: (args?: unknown) => Promise<any>;
    create: (args: unknown) => Promise<any>;
    update: (args: unknown) => Promise<any>;
  };
  review: {
    count: (args?: unknown) => Promise<number>;
    findMany: (args?: unknown) => Promise<any[]>;
    findUnique: (args: unknown) => Promise<any>;
    update: (args: unknown) => Promise<any>;
  };
  user: {
    count: (args?: unknown) => Promise<number>;
    findMany: (args?: unknown) => Promise<any[]>;
    findUnique: (args: unknown) => Promise<any>;
    update: (args: unknown) => Promise<any>;
  };
};

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function serializeUser(user: any) {
  return {
    ...user,
    role: toAppRole(user.role),
  };
}

async function getPlatformSettings() {
  const existing = await db.platformSetting.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      commissionRatePercent: true,
      createdAt: true,
      id: true,
      updatedAt: true,
    },
  });

  if (existing) {
    return existing;
  }

  return db.platformSetting.create({
    data: {},
    select: {
      commissionRatePercent: true,
      createdAt: true,
      id: true,
      updatedAt: true,
    },
  });
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, count: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1));
}

function differenceInNights(checkIn: Date, checkOut: Date) {
  return Math.max(
    0,
    Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

function overlapNights(booking: { checkIn: Date; checkOut: Date }, rangeStart: Date, rangeEnd: Date) {
  const start = booking.checkIn > rangeStart ? booking.checkIn : rangeStart;
  const end = booking.checkOut < rangeEnd ? booking.checkOut : rangeEnd;

  if (end <= start) return 0;
  return differenceInNights(start, end);
}

export async function adminRoutes(server: FastifyInstance) {
  server.get("/admin/overview", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const [settings, users, listings, bookings, reviews, payments] = await Promise.all([
      getPlatformSettings(),
      db.user.findMany({
        select: { id: true, isBanned: true, isSuspended: true, isVerified: true },
      }),
      db.listing.findMany({
        select: { id: true, status: true, createdAt: true },
      }),
      db.booking.findMany({
        select: {
          checkIn: true,
          checkOut: true,
          createdAt: true,
          status: true,
          totalPrice: true,
        },
      }),
      db.review.findMany({
        select: { id: true, moderationStatus: true },
      }),
      db.payment.findMany({
        select: { amountTotal: true, createdAt: true, status: true },
      }),
    ]);

    const commissionRatePercent = toNumber(settings.commissionRatePercent);
    const grossBookingRevenue = bookings.reduce(
      (sum, booking) => sum + toNumber(booking.totalPrice),
      0,
    );
    const paidRevenue = payments
      .filter((payment) => payment.status === "PAID")
      .reduce((sum, payment) => sum + toNumber(payment.amountTotal), 0);
    const estimatedCommissionRevenue = Number(
      ((paidRevenue * commissionRatePercent) / 100).toFixed(2),
    );
    const publishedListings = listings.filter((listing) => listing.status === "PUBLISHED").length;
    const pendingBookings = bookings.filter((booking) => booking.status === "PENDING").length;
    const confirmedBookings = bookings.filter((booking) => booking.status === "CONFIRMED").length;
    const cancelledBookings = bookings.filter((booking) => booking.status === "CANCELLED").length;
    const hiddenReviews = reviews.filter(
      (review) => review.moderationStatus === "HIDDEN",
    ).length;

    const currentMonth = startOfMonth(new Date());
    const trendMonths = Array.from({ length: 6 }, (_, index) =>
      addMonths(currentMonth, index - 5),
    );

    const trends = trendMonths.map((monthStart) => {
      const monthEnd = addMonths(monthStart, 1);
      const monthLabel = monthStart.toISOString().slice(0, 7);
      const monthBookings = bookings.filter(
        (booking) => booking.createdAt >= monthStart && booking.createdAt < monthEnd,
      );
      const monthPaidRevenue = payments
        .filter(
          (payment) =>
            payment.status === "PAID" &&
            payment.createdAt >= monthStart &&
            payment.createdAt < monthEnd,
        )
        .reduce((sum, payment) => sum + toNumber(payment.amountTotal), 0);
      const confirmedNights = bookings
        .filter((booking) => booking.status === "CONFIRMED")
        .reduce(
          (sum, booking) => sum + overlapNights(booking, monthStart, monthEnd),
          0,
        );
      const daysInMonth = differenceInNights(monthStart, monthEnd);
      const capacity = Math.max(1, publishedListings * daysInMonth);
      const occupancyRate = Number(((confirmedNights / capacity) * 100).toFixed(1));

      return {
        month: monthLabel,
        bookings: monthBookings.length,
        occupancyRate,
        paidRevenue: Number(monthPaidRevenue.toFixed(2)),
      };
    });

    return reply.send({
      overview: {
        bookingStatus: {
          cancelled: cancelledBookings,
          confirmed: confirmedBookings,
          pending: pendingBookings,
        },
        finance: {
          commissionRatePercent,
          estimatedCommissionRevenue,
          grossBookingRevenue: Number(grossBookingRevenue.toFixed(2)),
          paidRevenue: Number(paidRevenue.toFixed(2)),
        },
        moderation: {
          archivedListings: listings.filter((listing) => listing.status === "ARCHIVED").length,
          bannedUsers: users.filter((user) => user.isBanned).length,
          hiddenReviews,
          suspendedUsers: users.filter((user) => user.isSuspended).length,
          verifiedUsers: users.filter((user) => user.isVerified).length,
        },
        paymentStatus: {
          cancelled: payments.filter((payment) => payment.status === "CANCELLED").length,
          failed: payments.filter((payment) => payment.status === "FAILED").length,
          paid: payments.filter((payment) => payment.status === "PAID").length,
          pending: payments.filter((payment) => payment.status === "PENDING").length,
        },
        stats: {
          bookings: bookings.length,
          listings: listings.length,
          paidPayments: payments.filter((payment) => payment.status === "PAID").length,
          payments: payments.length,
          publishedListings,
          reviews: reviews.length,
          users: users.length,
        },
        trends,
      },
    });
  });

  server.get("/admin/settings", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const settings = await getPlatformSettings();
    return reply.send({
      settings: {
        ...settings,
        commissionRatePercent: toNumber(settings.commissionRatePercent),
      },
    });
  });

  server.patch("/admin/settings", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const parsed = updatePlatformSettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid request body",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const settings = await getPlatformSettings();
    const updated = await db.platformSetting.update({
      where: { id: settings.id },
      data: { commissionRatePercent: parsed.data.commissionRatePercent },
      select: {
        commissionRatePercent: true,
        createdAt: true,
        id: true,
        updatedAt: true,
      },
    });

    return reply.send({
      settings: {
        ...updated,
        commissionRatePercent: toNumber(updated.commissionRatePercent),
      },
    });
  });

  server.get("/admin/users", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const users = await db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        email: true,
        id: true,
        isBanned: true,
        isSuspended: true,
        isVerified: true,
        name: true,
        role: true,
      },
    });

    return reply.send({
      users: users.map((user) => serializeUser(user)),
    });
  });

  server.patch("/admin/users/:id/role", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const parsed = updateUserRoleSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid request body",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const existing = await db.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return reply.code(404).send({ message: "User not found" });
    }

    const user = await db.user.update({
      where: { id },
      data: {
        role: toDbRole(parsed.data.role),
      },
      select: {
        createdAt: true,
        email: true,
        id: true,
        isBanned: true,
        isSuspended: true,
        isVerified: true,
        name: true,
        role: true,
      },
    });

    return reply.send({
      user: serializeUser(user),
    });
  });

  server.patch("/admin/users/:id/moderation", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const parsed = updateUserModerationSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid request body",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const existing = await db.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return reply.code(404).send({ message: "User not found" });
    }

    const user = await db.user.update({
      where: { id },
      data: parsed.data,
      select: {
        createdAt: true,
        email: true,
        id: true,
        isBanned: true,
        isSuspended: true,
        isVerified: true,
        name: true,
        role: true,
      },
    });

    return reply.send({
      user: serializeUser(user),
    });
  });

  server.get("/admin/listings", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const listings = await db.listing.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        city: true,
        country: true,
        createdAt: true,
        host: { select: { email: true, id: true, name: true } },
        id: true,
        moderationNote: true,
        pricePerDay: true,
        status: true,
        title: true,
        _count: {
          select: {
            bookings: true,
            reviews: true,
          },
        },
      },
    });

    return reply.send({ listings });
  });

  server.patch("/admin/listings/:id/status", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const parsed = updateListingStatusSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid request body",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const existing = await db.listing.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return reply.code(404).send({ message: "Listing not found" });
    }

    const listing = await db.listing.update({
      where: { id },
      data: {
        moderationNote: parsed.data.moderationNote ?? null,
        status: parsed.data.status,
      },
      select: {
        id: true,
        moderationNote: true,
        status: true,
        title: true,
      },
    });

    return reply.send({ listing });
  });

  server.get("/admin/bookings", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const bookings = await db.booking.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        checkIn: true,
        checkOut: true,
        createdAt: true,
        guest: { select: { email: true, id: true, name: true } },
        id: true,
        listing: {
          select: {
            host: { select: { email: true, id: true, name: true } },
            id: true,
            title: true,
          },
        },
        payment: {
          select: {
            amountTotal: true,
            currency: true,
            id: true,
            status: true,
          },
        },
        status: true,
        totalPrice: true,
      },
    });

    return reply.send({ bookings });
  });

  server.get("/admin/reviews", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const reviews = await db.review.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        author: { select: { email: true, id: true, name: true } },
        comment: true,
        createdAt: true,
        id: true,
        listing: { select: { id: true, title: true } },
        moderationNote: true,
        moderationStatus: true,
        rating: true,
      },
    });

    return reply.send({ reviews });
  });

  server.patch("/admin/reviews/:id/moderation", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const parsed = updateReviewModerationSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid request body",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const existing = await db.review.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return reply.code(404).send({ message: "Review not found" });
    }

    const review = await db.review.update({
      where: { id },
      data: {
        moderationNote: parsed.data.moderationNote ?? null,
        moderationStatus: parsed.data.moderationStatus,
      },
      select: {
        id: true,
        moderationNote: true,
        moderationStatus: true,
      },
    });

    return reply.send({ review });
  });

  server.get("/admin/payments", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const payments = await db.payment.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        amountTotal: true,
        booking: {
          select: {
            id: true,
            listing: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        createdAt: true,
        currency: true,
        guest: { select: { email: true, id: true, name: true } },
        id: true,
        status: true,
        stripeCheckoutSessionId: true,
      },
    });

    return reply.send({ payments });
  });
}
