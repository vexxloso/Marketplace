"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

export default function SearchBar({
  totalCount,
  children,
}: {
  totalCount: number;
  children?: ReactNode;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [city, setCity] = useState(params.get("city") ?? "");
  const [country, setCountry] = useState(params.get("country") ?? "");
  const [checkIn, setCheckIn] = useState(params.get("checkIn") ?? "");
  const [checkOut, setCheckOut] = useState(params.get("checkOut") ?? "");
  const [minPrice, setMinPrice] = useState(params.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(params.get("maxPrice") ?? "");
  const [minRating, setMinRating] = useState(params.get("minRating") ?? "");
  const [instantBook, setInstantBook] = useState(params.get("instantBook") === "true");
  const [availableOnly, setAvailableOnly] = useState(
    params.get("availableOnly") === "true",
  );
  const [latitude, setLatitude] = useState(params.get("latitude") ?? "");
  const [longitude, setLongitude] = useState(params.get("longitude") ?? "");
  const [radiusKm, setRadiusKm] = useState(params.get("radiusKm") ?? "");
  const [sort, setSort] = useState(params.get("sort") ?? "newest");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (city.trim()) sp.set("city", city.trim());
    if (country.trim()) sp.set("country", country.trim());
    if (checkIn) sp.set("checkIn", checkIn);
    if (checkOut) sp.set("checkOut", checkOut);
    if (minPrice) sp.set("minPrice", minPrice);
    if (maxPrice) sp.set("maxPrice", maxPrice);
    if (minRating) sp.set("minRating", minRating);
    if (instantBook) sp.set("instantBook", "true");
    if (availableOnly) sp.set("availableOnly", "true");
    if (latitude) sp.set("latitude", latitude);
    if (longitude) sp.set("longitude", longitude);
    if (radiusKm) sp.set("radiusKm", radiusKm);
    if (sort !== "newest") sp.set("sort", sort);
    router.push(`/listings?${sp.toString()}`);
  }

  function handleClear() {
    setQ("");
    setCity("");
    setCountry("");
    setCheckIn("");
    setCheckOut("");
    setMinPrice("");
    setMaxPrice("");
    setMinRating("");
    setInstantBook(false);
    setAvailableOnly(false);
    setLatitude("");
    setLongitude("");
    setRadiusKm("");
    setSort("newest");
    router.push("/listings");
  }

  const hasFilters =
    q ||
    city ||
    country ||
    checkIn ||
    checkOut ||
    minPrice ||
    maxPrice ||
    minRating ||
    instantBook ||
    availableOnly ||
    latitude ||
    longitude ||
    radiusKm ||
    sort !== "newest";

  return (
    <div className="listings-search-page">
      <section className="search-banner">
        <div className="search-banner-overlay">
          <div className="search-banner-stack">
            <div className="search-banner-copy">
              <p className="eyebrow search-banner-eyebrow">Search · Maison Noir</p>
              <h1 className="search-banner-headline">
                Find an experience that will make you stand out.
              </h1>
              <p className="search-banner-lede">
                Explore architect-led homes, boutique villas, and city residences with transparent pricing,
                responsive hosts, and tools to search by place, dates, budget, and what matters to you.
              </p>
              <ul className="search-banner-highlights" aria-label="Search benefits">
                <li>Curated, guest-ready homes</li>
                <li>List &amp; map discovery</li>
                <li>Dynamic pricing &amp; availability</li>
                <li>Reviews you can trust</li>
              </ul>
            </div>
            <form onSubmit={handleSearch} className="search-banner-form">
              <input
                type="text"
                placeholder="What real estate do you want to rent?"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="search-input search-input-banner"
              />
              <button type="submit" className="search-btn search-btn-banner">
                Search
              </button>
            </form>
          </div>
        </div>
      </section>

      <div className="container listings-search-inner">
        <div className="search-breadcrumbs">
          <span>Home</span>
          <span>&middot;</span>
          <span>Search</span>
        </div>

        <div className="listings-split-layout">
        <form onSubmit={handleSearch} className="search-bar search-shell search-shell-listings search-shell-sidebar">
          <div className="search-shell-top">
            <div>
              <p className="eyebrow">All stays</p>
              <h2>
                All stays <span className="search-count-badge">{totalCount}</span>
              </h2>
            </div>
            {hasFilters && (
              <button type="button" onClick={handleClear} className="clear-btn">
                Clear all
              </button>
            )}
          </div>

          <div className="search-filter-layout">
            <div className="search-filter-sidebar">
              <details className="filter-accordion-item" open>
                <summary>Price</summary>
                <div className="filter-accordion-content">
                  <div className="filter-row filter-row-advanced">
                    <label className="filter-group">
                      <span>Min price</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        className="filter-input"
                      />
                    </label>

                    <label className="filter-group">
                      <span>Max price</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="Any"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        className="filter-input"
                      />
                    </label>
                  </div>
                </div>
              </details>

              <details className="filter-accordion-item">
                <summary>Dates</summary>
                <div className="filter-accordion-content">
                  <div className="filter-row filter-row-advanced">
                    <label className="filter-group">
                      <span>Check-in</span>
                      <input
                        type="date"
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                        className="filter-input filter-input-date"
                      />
                    </label>

                    <label className="filter-group">
                      <span>Check-out</span>
                      <input
                        type="date"
                        value={checkOut}
                        min={checkIn || undefined}
                        onChange={(e) => setCheckOut(e.target.value)}
                        className="filter-input filter-input-date"
                      />
                    </label>
                  </div>
                </div>
              </details>

              <details className="filter-accordion-item">
                <summary>Type of Place</summary>
                <div className="filter-accordion-content">
                  <p className="dashboard-meta">Coming soon</p>
                </div>
              </details>

              <details className="filter-accordion-item">
                <summary>Essential Amenities</summary>
                <div className="filter-accordion-content">
                  <p className="dashboard-meta">Coming soon</p>
                </div>
              </details>

              <details className="filter-accordion-item">
                <summary>Booking Options</summary>
                <div className="filter-accordion-content">
                  <div className="filter-row filter-row-toggles">
                    <label className="filter-check">
                      <input
                        type="checkbox"
                        checked={instantBook}
                        onChange={(e) => setInstantBook(e.target.checked)}
                      />
                      <span>Instant book only</span>
                    </label>

                    <label className="filter-check">
                      <input
                        type="checkbox"
                        checked={availableOnly}
                        onChange={(e) => setAvailableOnly(e.target.checked)}
                      />
                      <span>Only show available dates</span>
                    </label>
                  </div>
                </div>
              </details>

              <details className="filter-accordion-item">
                <summary>Property Type</summary>
                <div className="filter-accordion-content">
                  <p className="dashboard-meta">Coming soon</p>
                </div>
              </details>

              <details className="filter-accordion-item">
                <summary>Features</summary>
                <div className="filter-accordion-content">
                  <label className="filter-group">
                    <span>Minimum rating</span>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      placeholder="4.5"
                      value={minRating}
                      onChange={(e) => setMinRating(e.target.value)}
                      className="filter-input"
                    />
                  </label>

                  <label className="filter-group">
                    <span>Sort</span>
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                      className="filter-select"
                    >
                      <option value="newest">Newest arrivals</option>
                      <option value="oldest">Earliest added</option>
                      <option value="price_asc">Price: Low to high</option>
                      <option value="price_desc">Price: High to low</option>
                      <option value="rating_desc">Rating high to low</option>
                      <option value="distance">Nearest first</option>
                      <option value="availability">Availability first</option>
                      <option value="relevance">Relevance</option>
                    </select>
                  </label>
                </div>
              </details>

              <details className="filter-accordion-item">
                <summary>Location</summary>
                <div className="filter-accordion-content">
                  <div className="filter-row filter-row-advanced">
                    <label className="filter-group filter-group-featured">
                      <span>City</span>
                      <input
                        type="text"
                        placeholder="Lisbon"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="filter-input filter-input-wide"
                      />
                    </label>

                    <label className="filter-group filter-group-featured">
                      <span>Country</span>
                      <input
                        type="text"
                        placeholder="Portugal"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="filter-input filter-input-wide"
                      />
                    </label>
                  </div>
                </div>
              </details>

              <details className="filter-accordion-item">
                <summary>Search by Tags</summary>
                <div className="filter-accordion-content">
                  <div className="filter-row filter-row-advanced">
                    <label className="filter-group">
                      <span>Map center latitude</span>
                      <input
                        type="number"
                        step="0.000001"
                        placeholder="40.7128"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        className="filter-input filter-input-wide"
                      />
                    </label>

                    <label className="filter-group">
                      <span>Map center longitude</span>
                      <input
                        type="number"
                        step="0.000001"
                        placeholder="-74.0060"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        className="filter-input filter-input-wide"
                      />
                    </label>

                    <label className="filter-group">
                      <span>Radius in kilometers</span>
                      <input
                        type="number"
                        min="1"
                        placeholder="25"
                        value={radiusKm}
                        onChange={(e) => setRadiusKm(e.target.value)}
                        className="filter-input"
                      />
                    </label>
                  </div>
                </div>
              </details>

              <details className="search-advanced" open={Boolean(hasFilters)}>
                <summary>Selected filters</summary>
                <div className="filter-row filter-row-advanced">
                  {hasFilters ? (
                    <span className="dashboard-meta">Filters are active. Use clear all to reset.</span>
                  ) : (
                    <span className="dashboard-meta">No filters selected.</span>
                  )}
                </div>
              </details>

              <button type="submit" className="search-btn search-btn-wide">
                Show results
              </button>
            </div>
          </div>
        </form>
          <div className="listings-split-results">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
