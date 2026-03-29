import Link from "next/link";
import { apiFetch } from "../../../lib/api";
import BookingForm from "./BookingForm";
import ListingImages from "./ListingImages";
import ReviewSection from "./ReviewSection";

type ListingImage = {
  id: string;
  originalName: string;
  url: string;
};

type SeasonalRate = {
  id: string;
  startDate: string;
  endDate: string;
  pricePerDay: string;
};

type ListingDetail = {
  id: string;
  title: string;
  description: string;
  pricePerDay: string;
  weekendPrice?: string | null;
  cleaningFee?: string;
  minimumStayNights?: number;
  instantBook?: boolean;
  cancellationPolicy?: "FLEXIBLE" | "MODERATE" | "STRICT";
  lastMinuteDiscountPercent?: number;
  weeklyDiscountPercent?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  host: { id: string; name: string | null; email: string };
  reviewCount?: number;
  avgRating?: number | null;
  images?: ListingImage[];
  seasonalRates?: SeasonalRate[];
  location?: {
    display: string;
    latitude: number | null;
    longitude: number | null;
  };
};

type DetailResponse = {
  listing: ListingDetail;
};

async function getListing(id: string): Promise<ListingDetail | null> {
  try {
    const data = await apiFetch<DetailResponse>(`/listings/${id}`);
    return data.listing;
  } catch {
    return null;
  }
}

function statusBadgeClass(status: string): string {
  if (status === "PUBLISHED") return "badge badge-published";
  if (status === "DRAFT") return "badge badge-draft";
  return "badge badge-archived";
}

function formatPolicy(policy?: ListingDetail["cancellationPolicy"]) {
  if (!policy) return "Moderate";
  return policy.slice(0, 1) + policy.slice(1).toLowerCase();
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getListing(id);

  if (!listing) {
    return (
      <main className="container">
        <p className="warn">Listing not found or API unreachable.</p>
        <Link href="/listings">&larr; Back to listings</Link>
      </main>
    );
  }

  return (
    <main className="container listing-detail-page">
      <Link href="/listings" className="detail-back-link">&larr; Back to stays</Link>

      <section className="detail-hero">
        <div className="detail-hero-main">
          <div className="detail-header">
            <p className="eyebrow">Private stay</p>
            <div className="detail-title-row">
              <h1>{listing.title}</h1>
              {listing.status !== "PUBLISHED" ? (
                <span className={statusBadgeClass(listing.status)}>
                  {listing.status}
                </span>
              ) : null}
            </div>

            <div className="detail-price">
              ${listing.pricePerDay}/night
              {listing.avgRating != null && (
                <span className="detail-rating">
                  ★ {listing.avgRating} ({listing.reviewCount})
                </span>
              )}
            </div>

            <div className="detail-meta">
              Hosted by {listing.host.name ?? listing.host.email} &middot; Listed{" "}
              {new Date(listing.createdAt).toLocaleDateString()}
            </div>

            {listing.location?.display && (
              <div className="detail-meta">{listing.location.display}</div>
            )}

            <div className="detail-pill-row">
              <span className="listing-pill listing-pill-ok">
                {listing.instantBook ? "Instant confirmation" : "Host approval"}
              </span>
              <span className="listing-pill">
                Minimum {listing.minimumStayNights ?? 1} night
                {(listing.minimumStayNights ?? 1) > 1 ? "s" : ""}
              </span>
              <span className="listing-pill">
                {formatPolicy(listing.cancellationPolicy)} cancellation
              </span>
            </div>
          </div>

          <ListingImages initialImages={listing.images ?? []} />

          <div className="detail-story-grid">
            <section className="detail-panel">
              <p className="eyebrow">About this stay</p>
              <div className="detail-body">
                {listing.description.split("\n").map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>

            <section className="detail-panel">
              <p className="eyebrow">Stay details</p>
              <div className="detail-facts">
                <div className="detail-fact">
                  <strong>Cleaning fee</strong>
                  <span>${listing.cleaningFee ?? "0"}</span>
                </div>
                {listing.weekendPrice ? (
                  <div className="detail-fact">
                    <strong>Weekend rate</strong>
                    <span>${listing.weekendPrice}/night</span>
                  </div>
                ) : null}
                {(listing.weeklyDiscountPercent ?? 0) > 0 ? (
                  <div className="detail-fact">
                    <strong>Weekly discount</strong>
                    <span>{listing.weeklyDiscountPercent}% off</span>
                  </div>
                ) : null}
                {(listing.lastMinuteDiscountPercent ?? 0) > 0 ? (
                  <div className="detail-fact">
                    <strong>Last-minute offer</strong>
                    <span>{listing.lastMinuteDiscountPercent}% off</span>
                  </div>
                ) : null}
              </div>

              {!!listing.seasonalRates?.length && (
                <div className="detail-seasonal">
                  <strong>Seasonal pricing windows</strong>
                  <div className="detail-seasonal-list">
                    {listing.seasonalRates.map((rate) => (
                      <span key={rate.id} className="listing-pill">
                        {rate.startDate} to {rate.endDate} at ${rate.pricePerDay}/night
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>

        <aside className="detail-booking-column">
          {listing.status === "PUBLISHED" ? (
            <BookingForm
              listingId={listing.id}
              pricePerDay={Number(listing.pricePerDay)}
              cleaningFee={Number(listing.cleaningFee ?? 0)}
              minimumStayNights={listing.minimumStayNights ?? 1}
              instantBook={listing.instantBook ?? true}
            />
          ) : (
            <div className="booking-form">
              <h3>Availability coming soon</h3>
              <p className="dashboard-meta" style={{ marginTop: 0 }}>
                This stay is not currently published for guests, but its presentation is ready for launch.
              </p>
            </div>
          )}
        </aside>
      </section>

      <ReviewSection listingId={listing.id} />
    </main>
  );
}
