import { apiFetch } from "../../lib/api";
import ListingsExplorer from "./ListingsExplorer";
import SearchBar from "./SearchBar";

type Listing = {
  id: string;
  title: string;
  description: string;
  pricePerDay: string;
  status: string;
  createdAt: string;
  distanceKm?: number | null;
  isAvailable?: boolean | null;
  instantBook?: boolean;
  host: { id: string; name: string | null };
  reviewCount?: number;
  avgRating?: number | null;
  coverImageUrl?: string | null;
  location: {
    display: string;
    latitude: number | null;
    longitude: number | null;
  };
};

type ListingsResponse = {
  listings: Listing[];
  map: {
    bounds: {
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
    } | null;
    center: {
      latitude: number;
      longitude: number;
    } | null;
    totalWithCoordinates: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

async function getListings(
  searchParams: Record<string, string | undefined>,
): Promise<ListingsResponse | null> {
  try {
    const sp = new URLSearchParams();
    for (const key of [
      "q",
      "city",
      "country",
      "checkIn",
      "checkOut",
      "minPrice",
      "maxPrice",
      "minRating",
      "instantBook",
      "availableOnly",
      "latitude",
      "longitude",
      "radiusKm",
      "sort",
      "page",
    ]) {
      const value = searchParams[key];
      if (value) sp.set(key, value);
    }
    const qs = sp.toString();
    return await apiFetch<ListingsResponse>(`/listings${qs ? `?${qs}` : ""}`);
  } catch {
    return null;
  }
}

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getListings(params);

  return (
    <main className="listings-page">
      <SearchBar totalCount={data?.pagination.total ?? 0}>
        {!data ? (
          <p className="warn">
            Could not load listings. Make sure the API is running.
          </p>
        ) : data.listings.length === 0 ? (
          <div className="empty empty-luxury">
            <p>No stays match the current filters.</p>
            <p style={{ fontSize: "0.95rem" }}>
              Broaden the destination, shift your dates, or remove a few refinements to see more options.
            </p>
          </div>
        ) : (
          <ListingsExplorer listings={data.listings} map={data.map} />
        )}

        {data && data.pagination.totalPages > 1 && (
          <p className="pagination-note">
            Page {data.pagination.page} of {data.pagination.totalPages} &middot;{" "}
            {data.pagination.total} stays available
          </p>
        )}
      </SearchBar>
    </main>
  );
}
