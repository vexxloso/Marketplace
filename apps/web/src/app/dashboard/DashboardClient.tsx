"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { API_BASE, apiAssetUrl } from "../../lib/api";
import { clearStoredTokens, getStoredToken, storeToken } from "../../lib/auth";
import MessageInbox from "./MessageInbox";
import NotificationPanel from "./NotificationPanel";
import PayBookingButton from "./PayBookingButton";

type MeResponse = {
  user: {
    email: string;
    id: string;
    name: string | null;
    role: "guest" | "host" | "admin";
  };
};

type MyBooking = {
  id: string;
  checkIn: string;
  checkOut: string;
  createdAt: string;
  payment?: {
    id: string;
    status: "PENDING" | "PAID" | "FAILED" | "CANCELLED";
  } | null;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  totalPrice: string;
  listing: {
    id: string;
    pricePerDay: string;
    title: string;
  };
};

type IncomingBooking = {
  id: string;
  checkIn: string;
  checkOut: string;
  createdAt: string;
  payment?: {
    id: string;
    status: "PENDING" | "PAID" | "FAILED" | "CANCELLED";
  } | null;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  totalPrice: string;
  guest: {
    email: string;
    id: string;
    name: string | null;
  };
  listing: {
    id: string;
    title: string;
  };
};

type ListingSummary = {
  coverImageUrl?: string | null;
  createdAt: string;
  id: string;
  pricePerDay: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  title: string;
};

type ReviewSummary = {
  comment: string | null;
  createdAt: string;
  id: string;
  listing: {
    id: string;
    title: string;
  };
  rating: number;
};

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token.trim()}`,
  };
}

function DashboardStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="dashboard-stat">
      <span className="dashboard-stat-value">{value}</span>
      <span className="dashboard-stat-label">{label}</span>
    </div>
  );
}

function WindowsLoader({ label }: { label?: string }) {
  return (
    <div className="windows-loader-wrap" aria-live="polite" aria-busy="true">
      <div className="windows-loader" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <span
            key={index}
            className="windows-loader-dot"
            style={{ animationDelay: `${index * 0.12}s` }}
          />
        ))}
      </div>
      {label ? <span className="dashboard-section-note">{label}</span> : null}
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={index < rating ? "star-filled" : "star-empty"}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function statusClass(status: string) {
  if (status === "CONFIRMED" || status === "PUBLISHED") return "badge badge-published";
  if (status === "PENDING" || status === "DRAFT") return "badge badge-draft";
  return "badge badge-archived";
}

export default function DashboardClient() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<MeResponse["user"] | null>(null);
  const [guestBookings, setGuestBookings] = useState<MyBooking[]>([]);
  const [hostBookings, setHostBookings] = useState<IncomingBooking[]>([]);
  const [myListings, setMyListings] = useState<ListingSummary[]>([]);
  const [myReviews, setMyReviews] = useState<ReviewSummary[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [activeTab, setActiveTab] = useState<
    "overview" | "bookings" | "listings" | "incoming" | "reviews" | "messages"
  >("overview");

  useEffect(() => {
    const saved = getStoredToken();
    if (saved) {
      setToken(saved);
      void loadDashboard(saved);
    }
  }, []);

  const stats = useMemo(() => {
    return {
      guestBookings: guestBookings.length,
      hostBookings: hostBookings.length,
      listings: myListings.length,
      reviews: myReviews.length,
    };
  }, [guestBookings.length, hostBookings.length, myListings.length, myReviews.length]);

  const dashboardTabs = useMemo(() => {
    const tabs: Array<{
      id: "overview" | "bookings" | "listings" | "incoming" | "reviews" | "messages";
      label: string;
      count?: number;
    }> = [
      { id: "overview", label: "Overview" },
      { id: "bookings", label: "Trips", count: stats.guestBookings },
      { id: "reviews", label: "Reviews", count: stats.reviews },
      { id: "messages", label: "Messages" },
    ];

    if (user?.role === "host" || user?.role === "admin") {
      tabs.splice(2, 0, { id: "listings", label: "Listings", count: stats.listings });
      tabs.splice(3, 0, { id: "incoming", label: "Incoming", count: stats.hostBookings });
    }

    return tabs;
  }, [stats.guestBookings, stats.hostBookings, stats.listings, stats.reviews, user?.role]);

  useEffect(() => {
    if (!dashboardTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab("overview");
    }
  }, [activeTab, dashboardTabs]);

  async function loadDashboard(currentToken: string) {
    setStatus("loading");
    setMessage("");
    setActionMessage("");

    try {
      const meRes = await fetch(`${API_BASE}/auth/me`, {
        headers: authHeaders(currentToken),
      });

      const meData = await meRes.json();
      if (!meRes.ok) {
        setStatus("error");
        setMessage(meData.message ?? "Failed to load account");
        return;
      }

      const currentUser = (meData as MeResponse).user;
      setUser(currentUser);

      const requests: Promise<Response>[] = [
        fetch(`${API_BASE}/my/bookings`, {
          headers: authHeaders(currentToken),
        }),
        fetch(`${API_BASE}/my/reviews`, {
          headers: authHeaders(currentToken),
        }),
      ];

      if (currentUser.role === "host" || currentUser.role === "admin") {
        requests.push(
          fetch(`${API_BASE}/my/listings`, {
            headers: authHeaders(currentToken),
          }),
          fetch(`${API_BASE}/my/listings/bookings`, {
            headers: authHeaders(currentToken),
          }),
        );
      }

      const responses = await Promise.all(requests);
      const payloads = await Promise.all(responses.map((response) => response.json()));

      setGuestBookings(payloads[0].bookings ?? []);
      setMyReviews(payloads[1].reviews ?? []);
      setMyListings(payloads[2]?.listings ?? []);
      setHostBookings(payloads[3]?.bookings ?? []);

      storeToken(currentToken, currentUser.role);
      setStatus("ready");
    } catch {
      setStatus("error");
      setMessage("Could not load dashboard");
    }
  }

  async function runBookingAction(
    bookingId: string,
    action: "confirm" | "cancel",
  ) {
    if (!token.trim()) {
      setActionMessage("Token missing");
      return;
    }

    setActionMessage("Working...");

    try {
      const response = await fetch(`${API_BASE}/bookings/${bookingId}/${action}`, {
        method: "PATCH",
        headers: authHeaders(token),
      });

      const data = await response.json();
      if (!response.ok) {
        setActionMessage(data.message ?? `Could not ${action} booking`);
        return;
      }

      setActionMessage(
        action === "confirm" ? "Booking confirmed" : "Booking cancelled",
      );
      await loadDashboard(token);
    } catch {
      setActionMessage("Network error");
    }
  }

  function handleClearToken() {
    clearStoredTokens();
    setToken("");
    setUser(null);
    setGuestBookings([]);
    setHostBookings([]);
    setMyListings([]);
    setMyReviews([]);
    setStatus("idle");
    setMessage("");
    setActionMessage("");
  }

  function renderGuestBookings() {
    if (guestBookings.length === 0) {
      return <div className="empty dashboard-empty">No bookings yet.</div>;
    }

    return (
      <div className="dashboard-grid">
        {guestBookings.map((booking) => (
          <div key={booking.id} className="dashboard-card">
            <div className="dashboard-card-top">
              <Link href={`/listings/${booking.listing.id}`}>
                {booking.listing.title}
              </Link>
              <span className={statusClass(booking.status)}>
                {booking.status}
              </span>
            </div>
            <p className="dashboard-meta">Booking ID: {booking.id}</p>
            <p className="dashboard-meta">
              {new Date(booking.checkIn).toLocaleDateString()} to{" "}
              {new Date(booking.checkOut).toLocaleDateString()}
            </p>
            <p className="dashboard-meta">
              Payment: {booking.payment?.status ?? "UNPAID"}
            </p>
            <p className="dashboard-price">${booking.totalPrice} total</p>
            {booking.payment?.status !== "PAID" &&
            booking.status !== "CANCELLED" ? (
              <PayBookingButton bookingId={booking.id} token={token} />
            ) : null}
            {booking.status !== "CANCELLED" ? (
              <button
                type="button"
                className="dashboard-danger-btn"
                onClick={() => runBookingAction(booking.id, "cancel")}
              >
                Cancel booking
              </button>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  function renderListings() {
    if (myListings.length === 0) {
      return <div className="empty dashboard-empty">No listings yet.</div>;
    }

    return (
      <div className="dashboard-grid">
        {myListings.map((listing) => (
          <Link
            key={listing.id}
            href={`/listings/${listing.id}`}
            className="dashboard-listing-card"
          >
            {listing.coverImageUrl ? (
              <img
                src={apiAssetUrl(listing.coverImageUrl) ?? ""}
                alt={listing.title}
                className="dashboard-listing-image"
              />
            ) : (
              <div className="dashboard-listing-placeholder">
                Curated image coming soon
              </div>
            )}
            <div className="dashboard-listing-body">
              <div className="dashboard-card-top">
                <strong>{listing.title}</strong>
                <span className={statusClass(listing.status)}>
                  {listing.status}
                </span>
              </div>
              <p className="dashboard-price">${listing.pricePerDay}/night</p>
              <p className="dashboard-meta">
                Created {new Date(listing.createdAt).toLocaleDateString()}
              </p>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  function renderIncomingBookings() {
    if (hostBookings.length === 0) {
      return <div className="empty dashboard-empty">No incoming bookings yet.</div>;
    }

    return (
      <div className="dashboard-grid">
        {hostBookings.map((booking) => (
          <div key={booking.id} className="dashboard-card">
            <div className="dashboard-card-top">
              <Link href={`/listings/${booking.listing.id}`}>
                {booking.listing.title}
              </Link>
              <span className={statusClass(booking.status)}>
                {booking.status}
              </span>
            </div>
            <p className="dashboard-meta">
              Guest: {booking.guest.name ?? booking.guest.email}
            </p>
            <p className="dashboard-meta">
              {new Date(booking.checkIn).toLocaleDateString()} to{" "}
              {new Date(booking.checkOut).toLocaleDateString()}
            </p>
            <p className="dashboard-meta">
              Payment: {booking.payment?.status ?? "UNPAID"}
            </p>
            <p className="dashboard-price">${booking.totalPrice} total</p>

            <div className="dashboard-card-actions">
              {booking.status === "PENDING" ? (
                <button
                  type="button"
                  className="dashboard-primary-btn"
                  onClick={() => runBookingAction(booking.id, "confirm")}
                >
                  Confirm
                </button>
              ) : null}
              {booking.status !== "CANCELLED" ? (
                <button
                  type="button"
                  className="dashboard-danger-btn"
                  onClick={() => runBookingAction(booking.id, "cancel")}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderReviews() {
    if (myReviews.length === 0) {
      return <div className="empty dashboard-empty">No reviews yet.</div>;
    }

    return (
      <div className="dashboard-grid">
        {myReviews.map((review) => (
          <div key={review.id} className="dashboard-card">
            <div className="dashboard-card-top">
              <Link href={`/listings/${review.listing.id}`}>
                {review.listing.title}
              </Link>
              <Stars rating={review.rating} />
            </div>
            {review.comment ? (
              <p className="dashboard-comment">{review.comment}</p>
            ) : (
              <p className="dashboard-meta">No written comment.</p>
            )}
            <p className="dashboard-meta">
              Reviewed {new Date(review.createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    );
  }

  function renderTabContent() {
    switch (activeTab) {
      case "overview":
        return (
          <div className="dashboard-tab-stack">
            <NotificationPanel enabled={status === "ready"} token={token} />
            <section className="dashboard-section">
              <div className="dashboard-section-header">
                <h2>Quick view</h2>
                {actionMessage ? (
                  <span className="dashboard-section-note">{actionMessage}</span>
                ) : null}
              </div>
              <div className="dashboard-grid dashboard-overview-grid">
                <div className="dashboard-card dashboard-overview-card">
                  <p className="eyebrow">Trips</p>
                  <h3>Your upcoming stays</h3>
                  <p className="dashboard-comment">
                    Track reservations, payment state, and trip timing in one place.
                  </p>
                  <button
                    type="button"
                    className="dashboard-tab-ghost"
                    onClick={() => setActiveTab("bookings")}
                  >
                    Open trips
                  </button>
                </div>
                {(user?.role === "host" || user?.role === "admin") && (
                  <div className="dashboard-card dashboard-overview-card">
                    <p className="eyebrow">Hosting</p>
                    <h3>Listings and incoming requests</h3>
                    <p className="dashboard-comment">
                      Review listings, new booking interest, and operational activity.
                    </p>
                    <div className="dashboard-inline-actions">
                      <button
                        type="button"
                        className="dashboard-tab-ghost"
                        onClick={() => setActiveTab("listings")}
                      >
                        View listings
                      </button>
                      <button
                        type="button"
                        className="dashboard-tab-ghost"
                        onClick={() => setActiveTab("incoming")}
                      >
                        Incoming bookings
                      </button>
                    </div>
                  </div>
                )}
                <div className="dashboard-card dashboard-overview-card">
                  <p className="eyebrow">Conversations</p>
                  <h3>Stay close to guests and hosts</h3>
                  <p className="dashboard-comment">
                    Open live threads, follow updates, and keep booking communication moving.
                  </p>
                  <button
                    type="button"
                    className="dashboard-tab-ghost"
                    onClick={() => setActiveTab("messages")}
                  >
                    Open messages
                  </button>
                </div>
              </div>
            </section>
          </div>
        );
      case "bookings":
        return (
          <section className="dashboard-section">
            <div className="dashboard-section-header">
              <h2>My bookings</h2>
              <span className="dashboard-section-note">
                Use booking IDs here when writing reviews.
              </span>
            </div>
            {renderGuestBookings()}
          </section>
        );
      case "listings":
        return (
          <section className="dashboard-section">
            <div className="dashboard-section-header">
              <h2>My listings</h2>
            </div>
            {renderListings()}
          </section>
        );
      case "incoming":
        return (
          <section className="dashboard-section">
            <div className="dashboard-section-header">
              <h2>Incoming bookings</h2>
              {actionMessage ? (
                <span className="dashboard-section-note">{actionMessage}</span>
              ) : null}
            </div>
            {renderIncomingBookings()}
          </section>
        );
      case "reviews":
        return (
          <section className="dashboard-section">
            <div className="dashboard-section-header">
              <h2>My reviews</h2>
            </div>
            {renderReviews()}
          </section>
        );
      case "messages":
        return <MessageInbox enabled={status === "ready"} token={token} />;
      default:
        return null;
    }
  }

  return (
    <main className="container dashboard-page">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Account hub</p>
          <p className="subtitle">
            Manage your stays, hosting activity, reviews, and conversations from one premium control center.
          </p>
        </div>

        {user ? (
          <div className="dashboard-hero-actions">
            <button
              type="button"
              className="clear-btn"
              onClick={() => void loadDashboard(token)}
              disabled={status === "loading"}
            >
              {status === "loading" ? (
                <span className="dashboard-button-loading">
                  <WindowsLoader />
                  Refreshing...
                </span>
              ) : (
                "Refresh account"
              )}
            </button>
            <button
              type="button"
              className="clear-btn"
              onClick={handleClearToken}
            >
              Sign out
            </button>
          </div>
        ) : null}
      </section>

      {!token.trim() ? (
        <section className="dashboard-auth-card dashboard-empty-shell">
          <p className="eyebrow">Secure access</p>
          <h2>Sign in to open your dashboard.</h2>
          <p className="dashboard-comment">
            Your account area loads automatically once you sign in. This page no longer asks customers to manage raw tokens.
          </p>
          <div className="dashboard-inline-actions">
            <Link href="/auth" className="hero-primary">
              Sign in
            </Link>
            <Link href="/listings" className="hero-secondary">
              Browse stays
            </Link>
          </div>
        </section>
      ) : status === "loading" && !user ? (
        <section className="dashboard-auth-card dashboard-empty-shell">
          <p className="eyebrow">Loading account</p>
          <div className="dashboard-loading-panel">
            <WindowsLoader label="Preparing your dashboard..." />
          </div>
          <p className="dashboard-comment">
            We are loading your profile, reservations, and activity.
          </p>
        </section>
      ) : user ? (
        <>
          <section className="dashboard-section">
            <div className="dashboard-account-card dashboard-account-shell">
              <div>
                <p className="eyebrow">Welcome back</p>
                <h2>{user.name ?? "Account"}</h2>
                <p className="dashboard-account-meta">{user.email}</p>
              </div>
              <div className="dashboard-account-side">
                <span className={statusClass(user.role.toUpperCase())}>{user.role}</span>
                <p className="dashboard-section-note">Everything updates automatically from your saved session.</p>
              </div>
            </div>

            <div className="dashboard-stats">
              <DashboardStat label="My bookings" value={stats.guestBookings} />
              <DashboardStat label="My reviews" value={stats.reviews} />
              {(user.role === "host" || user.role === "admin") && (
                <>
                  <DashboardStat label="My listings" value={stats.listings} />
                  <DashboardStat label="Incoming bookings" value={stats.hostBookings} />
                </>
              )}
            </div>

            <div className="dashboard-tab-bar">
              {dashboardTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={tab.id === activeTab ? "dashboard-tab active" : "dashboard-tab"}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span>{tab.label}</span>
                  {tab.count != null ? (
                    <span className="dashboard-tab-count">{tab.count}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </section>

          {renderTabContent()}
        </>
      ) : (
        <section className="dashboard-auth-card dashboard-empty-shell">
          <p className="eyebrow">Access issue</p>
          <h2>We could not open your dashboard.</h2>
          <p className="dashboard-comment">{message || "Please sign in again to continue."}</p>
          <div className="dashboard-inline-actions">
            <Link href="/auth" className="hero-primary">
              Sign in again
            </Link>
            <button type="button" className="clear-btn" onClick={handleClearToken}>
              Clear session
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
