"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { apiAssetUrl } from "../../lib/api";

type Listing = {
  id: string;
  title: string;
  description: string;
  pricePerDay: string;
  status: string;
  createdAt: string;
  distanceKm?: number | null;
  isAvailable?: boolean | null;
  host: { id: string; name: string | null };
  reviewCount?: number;
  avgRating?: number | null;
  coverImageUrl?: string | null;
  instantBook?: boolean;
  location: {
    display: string;
    latitude: number | null;
    longitude: number | null;
  };
};

type MapMeta = {
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

type Props = {
  listings: Listing[];
  map: MapMeta;
};

const fallbackImages = ["/home-visual-1.jpg", "/home-visual-4.jpg", "/home-visual-5.jpg"];

type Cluster = {
  id: string;
  latitude: number;
  longitude: number;
  listingIds: string[];
  minPrice: number;
};

function buildClusters(listings: Listing[], bounds: MapMeta["bounds"]): Cluster[] {
  const coordinateListings = listings.filter(
    (listing) =>
      listing.location.latitude != null && listing.location.longitude != null,
  );

  if (!coordinateListings.length) return [];

  const latRange = Math.max((bounds?.maxLat ?? 0) - (bounds?.minLat ?? 0), 0.05);
  const lngRange = Math.max((bounds?.maxLng ?? 0) - (bounds?.minLng ?? 0), 0.05);
  const latStep = Math.max(latRange / 5, 0.02);
  const lngStep = Math.max(lngRange / 5, 0.02);
  const buckets = new Map<string, Cluster>();

  for (const listing of coordinateListings) {
    const latitude = listing.location.latitude as number;
    const longitude = listing.location.longitude as number;
    const bucketKey = `${Math.floor(latitude / latStep)}:${Math.floor(longitude / lngStep)}`;
    const existing = buckets.get(bucketKey);

    if (existing) {
      existing.latitude = Number(((existing.latitude + latitude) / 2).toFixed(6));
      existing.longitude = Number(((existing.longitude + longitude) / 2).toFixed(6));
      existing.listingIds.push(listing.id);
      existing.minPrice = Math.min(existing.minPrice, Number(listing.pricePerDay));
      continue;
    }

    buckets.set(bucketKey, {
      id: bucketKey,
      latitude,
      longitude,
      listingIds: [listing.id],
      minPrice: Number(listing.pricePerDay),
    });
  }

  return [...buckets.values()];
}

export default function ListingsExplorer({ listings, map }: Props) {
  const [selectedId, setSelectedId] = useState<string>(listings[0]?.id ?? "");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  const clusters = useMemo(
    () => buildClusters(listings, map.bounds),
    [listings, map.bounds],
  );

  const effectiveBounds =
    map.bounds ??
    (clusters.length
      ? {
          minLat: Math.min(...clusters.map((cluster) => cluster.latitude)),
          maxLat: Math.max(...clusters.map((cluster) => cluster.latitude)),
          minLng: Math.min(...clusters.map((cluster) => cluster.longitude)),
          maxLng: Math.max(...clusters.map((cluster) => cluster.longitude)),
        }
      : null);

  function positionPoint(latitude: number, longitude: number) {
    if (!effectiveBounds) {
      return { x: 50, y: 50 };
    }

    const latSpan = Math.max(effectiveBounds.maxLat - effectiveBounds.minLat, 0.02);
    const lngSpan = Math.max(effectiveBounds.maxLng - effectiveBounds.minLng, 0.02);

    return {
      x: 10 + ((longitude - effectiveBounds.minLng) / lngSpan) * 80,
      y: 90 - ((latitude - effectiveBounds.minLat) / latSpan) * 80,
    };
  }

  return (
    <div className={`search-explorer ${viewMode === "map" ? "search-explorer-map" : "search-explorer-list"}`}>
      <div className="search-results-column">
        <div className="search-results-meta search-results-luxury-meta search-results-toolbar">
          <div>
            <p className="eyebrow">Selected results</p>
            <h2>{listings.length} stay{listings.length === 1 ? "" : "s"}</h2>
          </div>
          <div className="search-results-actions">
            <div className="search-view-toggle">
              <button
                type="button"
                className={viewMode === "list" ? "search-view-btn active" : "search-view-btn"}
                onClick={() => setViewMode("list")}
              >
                List
              </button>
              <button
                type="button"
                className={viewMode === "map" ? "search-view-btn active" : "search-view-btn"}
                onClick={() => setViewMode("map")}
              >
                Map
              </button>
            </div>
            <span>{map.totalWithCoordinates} mapped locations</span>
          </div>
        </div>

        {viewMode === "list" ? (
        <div className="listings-grid listings-grid-search">
          {listings.map((listing, index) => (
            <div
              key={listing.id}
              className={`listing-card ${selectedId === listing.id ? "listing-card-active" : ""}`}
              onMouseEnter={() => setSelectedId(listing.id)}
            >
              <Link
                href={`/listings/${listing.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                {listing.coverImageUrl ? (
                  <img
                    src={apiAssetUrl(listing.coverImageUrl) ?? ""}
                    alt={listing.title}
                    className="listing-card-image"
                  />
                ) : (
                  <div className="listing-card-placeholder listing-card-fallback">
                    <img
                      src={fallbackImages[index % fallbackImages.length]}
                      alt="Curated stay artwork"
                      className="listing-card-image"
                    />
                    <span className="listing-card-fallback-badge">Curated preview</span>
                  </div>
                )}
                <div className="listing-card-body">
                  <div className="listing-card-topline">
                    <span className="listing-card-location">
                      {listing.location.display || "Location coming soon"}
                    </span>
                    {listing.avgRating != null && (
                      <span className="card-rating">
                        ★ {listing.avgRating} ({listing.reviewCount})
                      </span>
                    )}
                  </div>

                  <h3>{listing.title}</h3>
                  <p className="desc">{listing.description}</p>

                  <div className="card-price-row">
                    <span className="price">${listing.pricePerDay}/night</span>
                    {listing.distanceKm != null && (
                      <span className="listing-distance">{listing.distanceKm} km away</span>
                    )}
                  </div>

                  <div className="listing-search-meta-row">
                    {listing.isAvailable != null && (
                      <span
                        className={`listing-pill ${
                          listing.isAvailable ? "listing-pill-ok" : "listing-pill-warn"
                        }`}
                      >
                        {listing.isAvailable ? "Available now" : "Dates unavailable"}
                      </span>
                    )}
                  </div>

                  <div className="listing-card-cta">
                    <button type="button" className="listing-instant-btn">
                      {listing.instantBook ? "Instant book" : "Request booking"}
                    </button>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
        ) : null}
      </div>

      {viewMode === "map" ? (
      <aside className="search-map-panel search-map-panel-active">
        <div className="search-map-header">
          <p className="eyebrow">Map lens</p>
          <h2>See where each stay sits.</h2>
          <p className="dashboard-meta">
            Price pins and clusters react to your live filters so the collection stays easy to scan geographically.
          </p>
        </div>

        <div className="search-map-canvas">
          {!clusters.length ? (
            <div className="search-map-empty">
              No listing coordinates yet. Add latitude/longitude to listings to render map pins.
            </div>
          ) : (
            <svg viewBox="0 0 100 100" className="search-map-svg" aria-label="Listings map">
              <defs>
                <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0f172a" />
                  <stop offset="100%" stopColor="#1e293b" />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="100" height="100" rx="6" fill="url(#mapGradient)" />
              <path
                d="M8 22C21 19 28 31 41 27C53 23 62 10 76 15C87 19 92 12 95 7V92H8Z"
                fill="rgba(96,165,250,0.08)"
              />
              <path
                d="M5 56C15 47 25 61 39 54C51 48 63 42 73 48C84 54 90 43 97 34"
                fill="none"
                stroke="rgba(148,163,184,0.15)"
                strokeWidth="1.5"
              />
              {clusters.map((cluster) => {
                const point = positionPoint(cluster.latitude, cluster.longitude);
                const isCluster = cluster.listingIds.length > 1;
                const isSelected = cluster.listingIds.includes(selectedId);
                const priceLabel = `$${Math.round(cluster.minPrice)}`;
                const pinWidth = Math.max(14, priceLabel.length * 3.8 + 5);

                return (
                  <g
                    key={cluster.id}
                    transform={`translate(${point.x}, ${point.y})`}
                    onClick={() => setSelectedId(cluster.listingIds[0])}
                    style={{ cursor: "pointer" }}
                  >
                    {isCluster ? (
                      <>
                        <circle
                          r={6.5}
                          fill={isSelected ? "#2563eb" : "#f59e0b"}
                          stroke={isSelected ? "#93c5fd" : "#fef3c7"}
                          strokeWidth="1.2"
                        />
                        <text
                          textAnchor="middle"
                          dy="1.2"
                          fontSize="4"
                          fill="#fff"
                          fontWeight="700"
                        >
                          {cluster.listingIds.length}
                        </text>
                      </>
                    ) : (
                      <>
                        <rect
                          x={-pinWidth / 2}
                          y={-4.5}
                          width={pinWidth}
                          height={9}
                          rx={4.5}
                          fill={isSelected ? "#2563eb" : "#111827"}
                          stroke={isSelected ? "#93c5fd" : "#e5e7eb"}
                          strokeWidth="1"
                        />
                        <text
                          textAnchor="middle"
                          dy="1.3"
                          fontSize="2.9"
                          fill="#fff"
                          fontWeight="700"
                        >
                          {priceLabel}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </aside>
      ) : null}
    </div>
  );
}
