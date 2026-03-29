import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireRoles, toAppRole, toDbRole } from "../../lib/auth";
import { prisma } from "../../lib/prisma";

const updateUserRoleSchema = z.object({
  role: z.enum(["user", "admin"]),
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

function parseAdminPagedQuery(query: { limit?: string; page?: string }) {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
  const rawLimit = parseInt(String(query.limit ?? "12"), 10);
  const limit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 12));
  const skip = (page - 1) * limit;
  return { limit, page, skip };
}

function serializeUser(user: any) {
  const role = toAppRole(user.role);
  return {
    ...user,
    isBanned: role === "admin" ? false : Boolean(user.isBanned),
    isSuspended: role === "admin" ? false : Boolean(user.isSuspended),
    isVerified: role === "admin" ? true : Boolean(user.isVerified),
    role,
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

    const query = request.query as { page?: string; limit?: string };
    const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
    const rawLimit = parseInt(String(query.limit ?? "12"), 10);
    const limit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 12));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      db.user.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
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
      }),
      db.user.count(),
    ]);

    const totalPages = total === 0 ? 1 : Math.ceil(total / limit);

    return reply.send({
      users: users.map((user) => serializeUser(user)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
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
        isBanned: parsed.data.role === "admin" ? false : undefined,
        isSuspended: parsed.data.role === "admin" ? false : undefined,
        isVerified: parsed.data.role === "admin" ? true : undefined,
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
    const parsed = updateUserModerationSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid request body",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const patch = parsed.data;
    const data: {
      isBanned?: boolean;
      isSuspended?: boolean;
      isVerified?: boolean;
    } = {};
    if (typeof patch.isBanned === "boolean") data.isBanned = patch.isBanned;
    if (typeof patch.isSuspended === "boolean") data.isSuspended = patch.isSuspended;
    if (typeof patch.isVerified === "boolean") data.isVerified = patch.isVerified;

    if (Object.keys(data).length === 0) {
      return reply.code(400).send({
        message: "Provide at least one of isVerified, isSuspended, or isBanned",
      });
    }

    try {
      const existing = await db.user.findUnique({
        where: { id },
        select: { id: true, role: true },
      });

      if (!existing) {
        return reply.code(404).send({ message: "User not found" });
      }

      if (existing.role === "ADMIN") {
        const adminUser = await db.user.findUnique({
          where: { id },
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
          user: serializeUser(adminUser),
        });
      }

      const user = await db.user.update({
        where: { id },
        data,
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
    } catch (error) {
      request.log.error({ err: error }, "admin user moderation update failed");
      return reply.code(500).send({
        message: "Could not update user moderation",
      });
    }
  });

  server.get("/admin/listings", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const query = request.query as { limit?: string; page?: string };
    const { limit, page, skip } = parseAdminPagedQuery(query);

    const [listings, total] = await Promise.all([
      db.listing.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
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
      }),
      db.listing.count(),
    ]);

    const totalPages = total === 0 ? 1 : Math.ceil(total / limit);

    return reply.send({
      listings,
      pagination: { limit, page, total, totalPages },
    });
  });

  server.get("/admin/host-options", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const users = await db.user.findMany({
      orderBy: [{ name: "asc" }, { email: "asc" }],
      take: 500,
      select: { email: true, id: true, name: true },
    });

    return reply.send({ users });
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

    const query = request.query as { limit?: string; page?: string };
    const { limit, page, skip } = parseAdminPagedQuery(query);

    const [bookings, total] = await Promise.all([
      db.booking.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
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
      }),
      db.booking.count(),
    ]);

    const totalPages = total === 0 ? 1 : Math.ceil(total / limit);

    return reply.send({
      bookings,
      pagination: { limit, page, total, totalPages },
    });
  });

  server.get("/admin/reviews", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const query = request.query as { limit?: string; page?: string };
    const { limit, page, skip } = parseAdminPagedQuery(query);

    const [reviews, total] = await Promise.all([
      db.review.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
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
      }),
      db.review.count(),
    ]);

    const totalPages = total === 0 ? 1 : Math.ceil(total / limit);

    return reply.send({
      reviews,
      pagination: { limit, page, total, totalPages },
    });
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

    const query = request.query as { limit?: string; page?: string };
    const { limit, page, skip } = parseAdminPagedQuery(query);

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
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
      }),
      db.payment.count(),
    ]);

    const totalPages = total === 0 ? 1 : Math.ceil(total / limit);

    return reply.send({
      payments,
      pagination: { limit, page, total, totalPages },
    });
  });
}
