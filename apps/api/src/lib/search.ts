export type CoordinatePoint = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineDistanceKm(a: CoordinatePoint, b: CoordinatePoint) {
  const latDelta = toRadians(b.latitude - a.latitude);
  const lngDelta = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function calculateRelevanceScore(input: {
  title: string;
  description: string;
  city?: string | null;
  country?: string | null;
  query?: string;
  avgRating?: number | null;
  isAvailable?: boolean | null;
}) {
  const query = input.query?.trim().toLowerCase();
  if (!query) {
    return input.avgRating ?? 0;
  }

  const title = input.title.toLowerCase();
  const description = input.description.toLowerCase();
  const city = input.city?.toLowerCase() ?? "";
  const country = input.country?.toLowerCase() ?? "";
  const tokens = query.split(/\s+/).filter(Boolean);
  let score = 0;

  if (title === query) score += 50;
  if (title.startsWith(query)) score += 30;
  if (`${city} ${country}`.trim() === query) score += 24;

  for (const token of tokens) {
    if (title.includes(token)) score += 14;
    if (description.includes(token)) score += 5;
    if (city.includes(token) || country.includes(token)) score += 10;
  }

  score += (input.avgRating ?? 0) * 2;
  if (input.isAvailable) score += 4;

  return score;
}

export function buildDisplayLocation(input: {
  city?: string | null;
  country?: string | null;
  state?: string | null;
}) {
  return [input.city, input.state, input.country].filter(Boolean).join(", ");
}

export function calculateCoordinateBounds(points: CoordinatePoint[]) {
  if (!points.length) return null;

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);

  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes),
  };
}
