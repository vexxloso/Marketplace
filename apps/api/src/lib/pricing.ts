const DAY_MS = 1000 * 60 * 60 * 24;

export type SeasonalRateInput = {
  startDate: Date;
  endDate: Date;
  pricePerDay: number | string;
};

export type ListingPricingInput = {
  pricePerDay: number | string;
  weekendPrice?: number | string | null;
  cleaningFee?: number | string | null;
  minimumStayNights?: number | null;
  weeklyDiscountPercent?: number | null;
  lastMinuteDiscountPercent?: number | null;
  seasonalRates?: SeasonalRateInput[] | null;
};

export type BookingQuote = {
  nights: number;
  minimumStayNights: number;
  nightlySubtotal: number;
  cleaningFee: number;
  weeklyDiscountPercent: number;
  weeklyDiscountAmount: number;
  lastMinuteDiscountPercent: number;
  lastMinuteDiscountAmount: number;
  totalPrice: number;
  nightlyRates: Array<{
    amount: number;
    date: string;
    source: "BASE" | "SEASONAL" | "WEEKEND";
  }>;
};

function normalizeUtcDate(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

export function formatDateOnly(value: Date) {
  return normalizeUtcDate(value).toISOString().slice(0, 10);
}

export function daysBetween(a: Date, b: Date) {
  return Math.round(
    (normalizeUtcDate(b).getTime() - normalizeUtcDate(a).getTime()) / DAY_MS,
  );
}

export function addDays(date: Date, days: number) {
  return new Date(normalizeUtcDate(date).getTime() + days * DAY_MS);
}

export function clampPercent(value: number | null | undefined) {
  return Math.min(100, Math.max(0, Math.round(value ?? 0)));
}

function money(value: number | string | null | undefined) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

function isWeekendNight(date: Date) {
  const day = normalizeUtcDate(date).getUTCDay();
  return day === 5 || day === 6;
}

function resolveNightRate(date: Date, listing: ListingPricingInput) {
  const seasonalRate = listing.seasonalRates?.find((rate) => {
    const start = normalizeUtcDate(rate.startDate).getTime();
    const end = normalizeUtcDate(rate.endDate).getTime();
    const current = normalizeUtcDate(date).getTime();
    return current >= start && current <= end;
  });

  if (seasonalRate) {
    return {
      amount: money(seasonalRate.pricePerDay),
      source: "SEASONAL" as const,
    };
  }

  if (listing.weekendPrice != null && isWeekendNight(date)) {
    return {
      amount: money(listing.weekendPrice),
      source: "WEEKEND" as const,
    };
  }

  return {
    amount: money(listing.pricePerDay),
    source: "BASE" as const,
  };
}

export function calculateBookingQuote(input: {
  checkIn: Date;
  checkOut: Date;
  listing: ListingPricingInput;
  today?: Date;
}): BookingQuote {
  const checkIn = normalizeUtcDate(input.checkIn);
  const checkOut = normalizeUtcDate(input.checkOut);
  const today = normalizeUtcDate(input.today ?? new Date());
  const nights = daysBetween(checkIn, checkOut);
  const minimumStayNights = Math.max(1, input.listing.minimumStayNights ?? 1);
  const weeklyDiscountPercent = clampPercent(input.listing.weeklyDiscountPercent);
  const lastMinuteDiscountPercent = clampPercent(input.listing.lastMinuteDiscountPercent);
  const cleaningFee = money(input.listing.cleaningFee);

  const nightlyRates = Array.from({ length: nights }, (_, index) => {
    const nightDate = addDays(checkIn, index);
    const rate = resolveNightRate(nightDate, input.listing);
    return {
      amount: rate.amount,
      date: formatDateOnly(nightDate),
      source: rate.source,
    };
  });

  const nightlySubtotal = money(
    nightlyRates.reduce((sum, night) => sum + night.amount, 0),
  );
  const qualifiesForWeeklyDiscount = nights >= 7;
  const daysUntilCheckIn = daysBetween(today, checkIn);
  const qualifiesForLastMinuteDiscount = daysUntilCheckIn >= 0 && daysUntilCheckIn <= 7;
  const weeklyDiscountAmount = qualifiesForWeeklyDiscount
    ? money((nightlySubtotal * weeklyDiscountPercent) / 100)
    : 0;
  const lastMinuteDiscountAmount = qualifiesForLastMinuteDiscount
    ? money((nightlySubtotal * lastMinuteDiscountPercent) / 100)
    : 0;
  const totalPrice = money(
    Math.max(
      0,
      nightlySubtotal - weeklyDiscountAmount - lastMinuteDiscountAmount + cleaningFee,
    ),
  );

  return {
    nights,
    minimumStayNights,
    nightlySubtotal,
    cleaningFee,
    weeklyDiscountPercent,
    weeklyDiscountAmount,
    lastMinuteDiscountPercent,
    lastMinuteDiscountAmount,
    totalPrice,
    nightlyRates,
  };
}
