import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireRoles } from "../../lib/auth";
import { formatDateOnly, parseDateOnly } from "../../lib/pricing";
import { prisma } from "../../lib/prisma";
import {
  buildDisplayLocation,
  calculateCoordinateBounds,
  calculateRelevanceScore,
  haversineDistanceKm,
} from "../../lib/search";
import { buildListingImageUrl } from "../../lib/uploads";

const db = prisma as {
  listing: {
    findMany: (args: unknown) => Promise<any[]>;
    findUnique: (args: unknown) => Promise<any>;
    create: (args: unknown) => Promise<any>;
    update: (args: unknown) => Promise<any>;
    delete: (args: unknown) => Promise<any>;
    count: (args: unknown) => Promise<number>;
  };
  user: {
    findUnique: (args: unknown) => Promise<{ id: string } | null>;
  };
};

const optionalTextField = z.string().trim().max(160).nullable().optional();
const booleanStringSchema = z.enum(["true", "false"]).transform((value) => value === "true");

const seasonalRateInputSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pricePerDay: z.number().positive(),
});

const pricingInputShape = {
  pricePerDay: z.number().positive(),
  weekendPrice: z.number().positive().nullable().optional(),
  cleaningFee: z.number().min(0).default(0),
  minimumStayNights: z.number().int().min(1).max(365).default(1),
  instantBook: z.boolean().default(true),
  cancellationPolicy: z.enum(["FLEXIBLE", "MODERATE", "STRICT"]).default("MODERATE"),
  lastMinuteDiscountPercent: z.number().int().min(0).max(100).default(0),
  weeklyDiscountPercent: z.number().int().min(0).max(100).default(0),
  seasonalRates: z.array(seasonalRateInputSchema).default([]),
} as const;

const hostIdField = z.string().min(1).optional();

const createListingSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  addressLine: optionalTextField,
  city: optionalTextField,
  state: optionalTextField,
  country: optionalTextField,
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  hostId: hostIdField,
  ...pricingInputShape,
});

const updateListingSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(10).max(5000).optional(),
  addressLine: optionalTextField,
  city: optionalTextField,
  state: optionalTextField,
  country: optionalTextField,
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  pricePerDay: z.number().positive().optional(),
  weekendPrice: z.number().positive().nullable().optional(),
  cleaningFee: z.number().min(0).optional(),
  minimumStayNights: z.number().int().min(1).max(365).optional(),
  instantBook: z.boolean().optional(),
  cancellationPolicy: z.enum(["FLEXIBLE", "MODERATE", "STRICT"]).optional(),
  lastMinuteDiscountPercent: z.number().int().min(0).max(100).optional(),
  weeklyDiscountPercent: z.number().int().min(0).max(100).optional(),
  seasonalRates: z.array(seasonalRateInputSchema).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  hostId: hostIdField,
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(12),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  q: z.string().optional(),
  city: z.string().trim().optional(),
  country: z.string().trim().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  instantBook: booleanStringSchema.optional(),
  availableOnly: booleanStringSchema.optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(10000).optional(),
  minLat: z.coerce.number().min(-90).max(90).optional(),
  maxLat: z.coerce.number().min(-90).max(90).optional(),
  minLng: z.coerce.number().min(-180).max(180).optional(),
  maxLng: z.coerce.number().min(-180).max(180).optional(),
  sort: z
    .enum([
      "newest",
      "oldest",
      "price_asc",
      "price_desc",
      "rating_desc",
      "distance",
      "relevance",
      "availability",
    ])
    .default("newest"),
}).superRefine((value, ctx) => {
  if ((value.checkIn && !value.checkOut) || (!value.checkIn && value.checkOut)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide both checkIn and checkOut together",
      path: value.checkIn ? ["checkOut"] : ["checkIn"],
    });
  }

  if ((value.latitude !== undefined && value.longitude === undefined) ||
      (value.latitude === undefined && value.longitude !== undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide both latitude and longitude together",
      path: ["latitude"],
    });
  }

  const boundValues = [value.minLat, value.maxLat, value.minLng, value.maxLng];
  const boundCount = boundValues.filter((item) => item !== undefined).length;
  if (boundCount > 0 && boundCount < 4) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide minLat, maxLat, minLng, and maxLng together",
      path: ["minLat"],
    });
  }
});

function toNumber(value: number | string | null | undefined) {
  if (value == null) return null;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

function serializeImages(
  images: Array<{
    fileName: string;
    id: string;
    originalName: string;
  }>,
) {
  return images.map((image) => ({
    id: image.id,
    originalName: image.originalName,
    url: buildListingImageUrl(image.fileName),
  }));
}

function serializeSeasonalRates(
  rates: Array<{
    endDate: Date;
    id: string;
    pricePerDay: string | number;
    startDate: Date;
  }>,
) {
  return rates.map((rate) => ({
    id: rate.id,
    startDate: formatDateOnly(rate.startDate),
    endDate: formatDateOnly(rate.endDate),
    pricePerDay: rate.pricePerDay,
  }));
}

function validateLocationPayload(input: {
  latitude?: number | null;
  longitude?: number | null;
}) {
  const hasLatitude = input.latitude !== undefined;
  const hasLongitude = input.longitude !== undefined;

  if (hasLatitude !== hasLongitude) {
    return "Latitude and longitude must be provided together";
  }

  if ((input.latitude === null) !== (input.longitude === null)) {
    return "Latitude and longitude must be cleared together";
  }

  return null;
}

function validateSeasonalRates(
  rates: Array<{
    endDate: string;
    startDate: string;
  }>,
) {
  const normalized = rates
    .map((rate) => ({
      endDate: parseDateOnly(rate.endDate),
      startDate: parseDateOnly(rate.startDate),
    }))
    .sort((a, b) => (a.startDate?.getTime() ?? 0) - (b.startDate?.getTime() ?? 0));

  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index];
    if (!current.startDate || !current.endDate) {
      return "Seasonal rates must use YYYY-MM-DD dates";
    }

    if (current.endDate < current.startDate) {
      return "Seasonal rate endDate must be on or after startDate";
    }

    if (index > 0) {
      const previous = normalized[index - 1];
      if (previous.endDate && previous.endDate >= current.startDate) {
        return "Seasonal rate ranges cannot overlap";
      }
    }
  }

  return null;
}

function buildSeasonalRateWrites(
  rates: Array<{
    endDate: string;
    pricePerDay: number;
    startDate: string;
  }>,
) {
  return rates.map((rate) => ({
    endDate: parseDateOnly(rate.endDate),
    pricePerDay: rate.pricePerDay,
    startDate: parseDateOnly(rate.startDate),
  }));
}

function serializeListing(
  raw: any,
  input?: {
    checkIn?: Date | null;
    checkOut?: Date | null;
    origin?: { latitude: number; longitude: number } | null;
    query?: string;
  },
) {
  const ratings = raw.reviews as { rating: number }[];
  const images = serializeImages(raw.images ?? []);
  const seasonalRates = serializeSeasonalRates(raw.seasonalRates ?? []);
  const reviewCount = ratings.length;
  const avgRating =
    reviewCount > 0
      ? Number(
          (
            ratings.reduce((sum: number, review: { rating: number }) => sum + review.rating, 0) /
            reviewCount
          ).toFixed(1),
        )
      : null;
  const isAvailable =
    input?.checkIn && input?.checkOut ? (raw.bookings?.length ?? 0) === 0 : null;
  const latitude = toNumber(raw.latitude);
  const longitude = toNumber(raw.longitude);
  const distanceKm =
    input?.origin && latitude != null && longitude != null
      ? Number(
          haversineDistanceKm(input.origin, { latitude, longitude }).toFixed(1),
        )
      : null;
  const {
    images: _images,
    reviews: _reviews,
    seasonalRates: _seasonalRates,
    bookings: _bookings,
    addressLine: _addressLine,
    city: _city,
    state: _state,
    country: _country,
    latitude: _latitude,
    longitude: _longitude,
    ...rest
  } = raw;

  return {
    ...rest,
    avgRating,
    coverImageUrl: images[0]?.url ?? null,
    distanceKm,
    images,
    isAvailable,
    location: {
      addressLine: raw.addressLine ?? null,
      city: raw.city ?? null,
      country: raw.country ?? null,
      display: buildDisplayLocation(raw),
      latitude,
      longitude,
      state: raw.state ?? null,
    },
    reviewCount,
    seasonalRates,
  };
}

export async function listingRoutes(server: FastifyInstance) {
  server.get("/listings", async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid query parameters",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { page, limit, status, q, minPrice, maxPrice, sort } = parsed.data;
    const checkIn = parsed.data.checkIn ? parseDateOnly(parsed.data.checkIn) : null;
    const checkOut = parsed.data.checkOut ? parseDateOnly(parsed.data.checkOut) : null;
    const origin =
      parsed.data.latitude !== undefined && parsed.data.longitude !== undefined
        ? {
            latitude: parsed.data.latitude,
            longitude: parsed.data.longitude,
          }
        : null;

    const where: Record<string, unknown> = {
      status: status ?? "PUBLISHED",
    };

    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { country: { contains: q, mode: "insensitive" } },
      ];
    }

    if (parsed.data.city) {
      where.city = { contains: parsed.data.city, mode: "insensitive" };
    }

    if (parsed.data.country) {
      where.country = { contains: parsed.data.country, mode: "insensitive" };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceFilter: Record<string, unknown> = {};
      if (minPrice !== undefined) priceFilter.gte = minPrice;
      if (maxPrice !== undefined) priceFilter.lte = maxPrice;
      where.pricePerDay = priceFilter;
    }

    if (parsed.data.instantBook !== undefined) {
      where.instantBook = parsed.data.instantBook;
    }

    if (
      parsed.data.minLat !== undefined &&
      parsed.data.maxLat !== undefined &&
      parsed.data.minLng !== undefined &&
      parsed.data.maxLng !== undefined
    ) {
      where.latitude = {
        gte: parsed.data.minLat,
        lte: parsed.data.maxLat,
      };
      where.longitude = {
        gte: parsed.data.minLng,
        lte: parsed.data.maxLng,
      };
    }

    const select: Record<string, unknown> = {
      id: true,
      title: true,
      description: true,
      addressLine: true,
      city: true,
      state: true,
      country: true,
      latitude: true,
      longitude: true,
      pricePerDay: true,
      weekendPrice: true,
      cleaningFee: true,
      minimumStayNights: true,
      instantBook: true,
      cancellationPolicy: true,
      lastMinuteDiscountPercent: true,
      weeklyDiscountPercent: true,
      status: true,
      createdAt: true,
      host: { select: { id: true, name: true } },
      images: {
        orderBy: { createdAt: "asc" },
        select: { fileName: true, id: true, originalName: true },
        take: 1,
      },
      reviews: { select: { rating: true } },
      seasonalRates: {
        orderBy: { startDate: "asc" },
        select: { id: true, startDate: true, endDate: true, pricePerDay: true },
      },
    };

    if (checkIn && checkOut) {
      select.bookings = {
        where: {
          status: { not: "CANCELLED" },
          checkIn: { lt: checkOut },
          checkOut: { gt: checkIn },
        },
        select: { id: true },
      };
    }

    const listings = await db.listing.findMany({
      where,
      select,
    });

    let enriched = listings.map((listing: any) =>
      serializeListing(listing, { checkIn, checkOut, origin, query: q }),
    );

    if (parsed.data.minRating !== undefined) {
      enriched = enriched.filter(
        (listing) => (listing.avgRating ?? 0) >= parsed.data.minRating!,
      );
    }

    if (origin && parsed.data.radiusKm !== undefined) {
      enriched = enriched.filter(
        (listing) =>
          listing.distanceKm != null && listing.distanceKm <= parsed.data.radiusKm!,
      );
    }

    if (parsed.data.availableOnly && checkIn && checkOut) {
      enriched = enriched.filter((listing) => listing.isAvailable === true);
    }

    const sortByDate = (direction: "asc" | "desc") =>
      enriched.sort((a, b) =>
        direction === "asc"
          ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    switch (sort) {
      case "oldest":
        sortByDate("asc");
        break;
      case "price_asc":
        enriched.sort((a, b) => Number(a.pricePerDay) - Number(b.pricePerDay));
        break;
      case "price_desc":
        enriched.sort((a, b) => Number(b.pricePerDay) - Number(a.pricePerDay));
        break;
      case "rating_desc":
        enriched.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));
        break;
      case "distance":
        enriched.sort((a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER));
        break;
      case "availability":
        enriched.sort((a, b) => {
          const availabilityScore = Number(Boolean(b.isAvailable)) - Number(Boolean(a.isAvailable));
          if (availabilityScore !== 0) return availabilityScore;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        break;
      case "relevance":
        enriched.sort((a, b) => {
          const aScore = calculateRelevanceScore({
            title: a.title,
            description: a.description,
            city: a.location.display,
            query: q,
            avgRating: a.avgRating,
            isAvailable: a.isAvailable,
          });
          const bScore = calculateRelevanceScore({
            title: b.title,
            description: b.description,
            city: b.location.display,
            query: q,
            avgRating: b.avgRating,
            isAvailable: b.isAvailable,
          });
          return bScore - aScore;
        });
        break;
      case "newest":
      default:
        sortByDate("desc");
        break;
    }

    const total = enriched.length;
    const skip = (page - 1) * limit;
    const pagedListings = enriched.slice(skip, skip + limit);
    const coordinatePoints = pagedListings
      .filter((listing) => listing.location.latitude != null && listing.location.longitude != null)
      .map((listing) => ({
        latitude: listing.location.latitude as number,
        longitude: listing.location.longitude as number,
      }));
    const bounds = calculateCoordinateBounds(coordinatePoints);
    const center =
      origin ??
      (bounds
        ? {
            latitude: Number(((bounds.minLat + bounds.maxLat) / 2).toFixed(6)),
            longitude: Number(((bounds.minLng + bounds.maxLng) / 2).toFixed(6)),
          }
        : null);

    return reply.send({
      listings: pagedListings,
      map: {
        bounds,
        center,
        totalWithCoordinates: coordinatePoints.length,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  server.get("/listings/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const raw = await db.listing.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        addressLine: true,
        city: true,
        state: true,
        country: true,
        latitude: true,
        longitude: true,
        pricePerDay: true,
        weekendPrice: true,
        cleaningFee: true,
        minimumStayNights: true,
        instantBook: true,
        cancellationPolicy: true,
        lastMinuteDiscountPercent: true,
        weeklyDiscountPercent: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        host: { select: { id: true, name: true, email: true } },
        images: {
          orderBy: { createdAt: "asc" },
          select: { fileName: true, id: true, originalName: true },
        },
        reviews: { select: { rating: true } },
        seasonalRates: {
          orderBy: { startDate: "asc" },
          select: { id: true, startDate: true, endDate: true, pricePerDay: true },
        },
      },
    });

    if (!raw) {
      return reply.code(404).send({ message: "Listing not found" });
    }

    return reply.send({
      listing: serializeListing(raw),
    });
  });

  server.post("/listings", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const parsed = createListingSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid request body",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const seasonalRateError = validateSeasonalRates(parsed.data.seasonalRates);
    if (seasonalRateError) {
      return reply.code(400).send({ message: seasonalRateError });
    }

    const locationError = validateLocationPayload(parsed.data);
    if (locationError) {
      return reply.code(400).send({ message: locationError });
    }

    let hostId = auth.sub;
    if (parsed.data.hostId) {
      const hostUser = await db.user.findUnique({
        where: { id: parsed.data.hostId },
        select: { id: true },
      });
      if (!hostUser) {
        return reply.code(400).send({ message: "Host user not found" });
      }
      hostId = parsed.data.hostId;
    }

    const listing = await db.listing.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        addressLine: parsed.data.addressLine ?? null,
        city: parsed.data.city ?? null,
        state: parsed.data.state ?? null,
        country: parsed.data.country ?? null,
        latitude: parsed.data.latitude ?? null,
        longitude: parsed.data.longitude ?? null,
        pricePerDay: parsed.data.pricePerDay,
        weekendPrice: parsed.data.weekendPrice ?? null,
        cleaningFee: parsed.data.cleaningFee,
        minimumStayNights: parsed.data.minimumStayNights,
        instantBook: parsed.data.instantBook,
        cancellationPolicy: parsed.data.cancellationPolicy,
        lastMinuteDiscountPercent: parsed.data.lastMinuteDiscountPercent,
        weeklyDiscountPercent: parsed.data.weeklyDiscountPercent,
        hostId,
        seasonalRates: {
          create: buildSeasonalRateWrites(parsed.data.seasonalRates),
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        addressLine: true,
        city: true,
        state: true,
        country: true,
        latitude: true,
        longitude: true,
        pricePerDay: true,
        weekendPrice: true,
        cleaningFee: true,
        minimumStayNights: true,
        instantBook: true,
        cancellationPolicy: true,
        lastMinuteDiscountPercent: true,
        weeklyDiscountPercent: true,
        status: true,
        createdAt: true,
        images: {
          orderBy: { createdAt: "asc" },
          select: { fileName: true, id: true, originalName: true },
        },
        reviews: { select: { rating: true } },
        seasonalRates: {
          orderBy: { startDate: "asc" },
          select: { id: true, startDate: true, endDate: true, pricePerDay: true },
        },
      },
    });

    return reply.code(201).send({ listing: serializeListing(listing) });
  });

  server.put("/listings/:id", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };

    const existing = await db.listing.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return reply.code(404).send({ message: "Listing not found" });
    }

    const parsed = updateListingSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid request body",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    if (parsed.data.seasonalRates) {
      const seasonalRateError = validateSeasonalRates(parsed.data.seasonalRates);
      if (seasonalRateError) {
        return reply.code(400).send({ message: seasonalRateError });
      }
    }

    const locationError = validateLocationPayload(parsed.data);
    if (locationError) {
      return reply.code(400).send({ message: locationError });
    }

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.hostId) {
      const hostUser = await db.user.findUnique({
        where: { id: parsed.data.hostId },
        select: { id: true },
      });
      if (!hostUser) {
        return reply.code(400).send({ message: "Host user not found" });
      }
      delete updateData.hostId;
      updateData.host = { connect: { id: parsed.data.hostId } };
    }
    if (parsed.data.seasonalRates) {
      updateData.seasonalRates = {
        deleteMany: {},
        create: buildSeasonalRateWrites(parsed.data.seasonalRates),
      };
    }

    const listing = await db.listing.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        title: true,
        description: true,
        addressLine: true,
        city: true,
        state: true,
        country: true,
        latitude: true,
        longitude: true,
        pricePerDay: true,
        weekendPrice: true,
        cleaningFee: true,
        minimumStayNights: true,
        instantBook: true,
        cancellationPolicy: true,
        lastMinuteDiscountPercent: true,
        weeklyDiscountPercent: true,
        status: true,
        updatedAt: true,
        createdAt: true,
        images: {
          orderBy: { createdAt: "asc" },
          select: { fileName: true, id: true, originalName: true },
        },
        reviews: { select: { rating: true } },
        seasonalRates: {
          orderBy: { startDate: "asc" },
          select: { id: true, startDate: true, endDate: true, pricePerDay: true },
        },
      },
    });

    return reply.send({ listing: serializeListing(listing) });
  });

  server.delete("/listings/:id", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };

    const existing = await db.listing.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return reply.code(404).send({ message: "Listing not found" });
    }

    await db.listing.delete({ where: { id } });

    return reply.code(204).send();
  });

  server.get("/my/listings", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const listings = await db.listing.findMany({
      where: { hostId: auth.sub },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        addressLine: true,
        city: true,
        state: true,
        country: true,
        latitude: true,
        longitude: true,
        pricePerDay: true,
        weekendPrice: true,
        cleaningFee: true,
        minimumStayNights: true,
        instantBook: true,
        cancellationPolicy: true,
        lastMinuteDiscountPercent: true,
        weeklyDiscountPercent: true,
        status: true,
        createdAt: true,
        images: {
          orderBy: { createdAt: "asc" },
          select: { fileName: true, id: true, originalName: true },
          take: 1,
        },
        reviews: { select: { rating: true } },
        seasonalRates: {
          orderBy: { startDate: "asc" },
          select: { id: true, startDate: true, endDate: true, pricePerDay: true },
        },
      },
    });

    return reply.send({
      listings: listings.map((listing: any) => serializeListing(listing)),
    });
  });
}
