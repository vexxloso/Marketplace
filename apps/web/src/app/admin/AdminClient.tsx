"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { API_BASE } from "../../lib/api";
import { clearStoredTokens, getStoredAdminToken, storeToken } from "../../lib/auth";

type AdminUser = {
  createdAt: string;
  email: string;
  id: string;
  isBanned: boolean;
  isSuspended: boolean;
  isVerified: boolean;
  name: string | null;
  role: "guest" | "host" | "admin";
};

type AdminListing = {
  city: string | null;
  country: string | null;
  createdAt: string;
  host: {
    email: string;
    id: string;
    name: string | null;
  };
  id: string;
  moderationNote: string | null;
  pricePerDay: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  title: string;
  _count: {
    bookings: number;
    reviews: number;
  };
};

type AdminBooking = {
  checkIn: string;
  checkOut: string;
  createdAt: string;
  guest: {
    email: string;
    id: string;
    name: string | null;
  };
  id: string;
  listing: {
    host: {
      email: string;
      id: string;
      name: string | null;
    };
    id: string;
    title: string;
  };
  status: string;
  totalPrice: string;
  payment?: {
    amountTotal: string;
    currency: string;
    id: string;
    status: string;
  } | null;
};

type AdminReview = {
  author: {
    email: string;
    id: string;
    name: string | null;
  };
  comment: string | null;
  createdAt: string;
  id: string;
  listing: {
    id: string;
    title: string;
  };
  moderationNote: string | null;
  moderationStatus: "VISIBLE" | "HIDDEN";
  rating: number;
};

type AdminPayment = {
  amountTotal: string;
  booking: {
    id: string;
    listing: {
      id: string;
      title: string;
    };
  };
  createdAt: string;
  currency: string;
  guest: {
    email: string;
    id: string;
    name: string | null;
  };
  id: string;
  status: string;
  stripeCheckoutSessionId: string | null;
};

type AdminOverview = {
  bookingStatus: {
    cancelled: number;
    confirmed: number;
    pending: number;
  };
  finance: {
    commissionRatePercent: number;
    estimatedCommissionRevenue: number;
    grossBookingRevenue: number;
    paidRevenue: number;
  };
  moderation: {
    archivedListings: number;
    bannedUsers: number;
    hiddenReviews: number;
    suspendedUsers: number;
    verifiedUsers: number;
  };
  paymentStatus: {
    cancelled: number;
    failed: number;
    paid: number;
    pending: number;
  };
  stats: {
    bookings: number;
    listings: number;
    paidPayments: number;
    payments: number;
    publishedListings: number;
    reviews: number;
    users: number;
  };
  trends: Array<{
    bookings: number;
    month: string;
    occupancyRate: number;
    paidRevenue: number;
  }>;
};

type AdminSettings = {
  commissionRatePercent: number;
};

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token.trim()}`,
    "Content-Type": "application/json",
  };
}

function statusClass(status: string) {
  if (
    status === "CONFIRMED" ||
    status === "PUBLISHED" ||
    status === "ADMIN" ||
    status === "PAID" ||
    status === "VISIBLE"
  ) {
    return "badge badge-published";
  }
  if (
    status === "PENDING" ||
    status === "DRAFT" ||
    status === "HOST" ||
    status === "FAILED"
  ) {
    return "badge badge-draft";
  }
  return "badge badge-archived";
}

function AdminStat({
  label,
  value,
}: {
  label: string;
  value: number;
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

export default function AdminClient() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [commissionDraft, setCommissionDraft] = useState("12");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [actionMessage, setActionMessage] = useState("");
  const [listingNoteDrafts, setListingNoteDrafts] = useState<Record<string, string>>({});
  const [reviewNoteDrafts, setReviewNoteDrafts] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<
    "overview" | "users" | "listings" | "bookings" | "reviews" | "payments" | "settings"
  >("overview");

  useEffect(() => {
    const saved = getStoredAdminToken();
    if (saved) {
      setToken(saved);
      void loadAdmin(saved);
    }
  }, []);

  const adminTabs = useMemo(
    () => [
      { id: "overview", label: "Overview" },
      { id: "users", label: "Users", count: users.length },
      { id: "listings", label: "Listings", count: listings.length },
      { id: "bookings", label: "Bookings", count: bookings.length },
      { id: "reviews", label: "Reviews", count: reviews.length },
      { id: "payments", label: "Payments", count: payments.length },
      { id: "settings", label: "Settings" },
    ] as const,
    [bookings.length, listings.length, payments.length, reviews.length, users.length],
  );

  async function loadAdmin(currentToken: string) {
    setStatus("loading");
    setMessage("");
    setActionMessage("");

    try {
      const responses = await Promise.all([
        fetch(`${API_BASE}/admin/overview`, {
          headers: { Authorization: `Bearer ${currentToken.trim()}` },
        }),
        fetch(`${API_BASE}/admin/settings`, {
          headers: { Authorization: `Bearer ${currentToken.trim()}` },
        }),
        fetch(`${API_BASE}/admin/users`, {
          headers: { Authorization: `Bearer ${currentToken.trim()}` },
        }),
        fetch(`${API_BASE}/admin/listings`, {
          headers: { Authorization: `Bearer ${currentToken.trim()}` },
        }),
        fetch(`${API_BASE}/admin/bookings`, {
          headers: { Authorization: `Bearer ${currentToken.trim()}` },
        }),
        fetch(`${API_BASE}/admin/reviews`, {
          headers: { Authorization: `Bearer ${currentToken.trim()}` },
        }),
        fetch(`${API_BASE}/admin/payments`, {
          headers: { Authorization: `Bearer ${currentToken.trim()}` },
        }),
      ]);

      const payloads = await Promise.all(responses.map((response) => response.json()));

      if (responses.some((response) => !response.ok)) {
        const firstError = payloads.find((payload) => payload?.message);
        setStatus("error");
        setMessage(firstError?.message ?? "Could not load admin panel");
        return;
      }

      const nextOverview = payloads[0].overview ?? null;
      const nextSettings = payloads[1].settings ?? null;
      const nextUsers = payloads[2].users ?? [];
      const nextListings = payloads[3].listings ?? [];
      const nextBookings = payloads[4].bookings ?? [];
      const nextReviews = payloads[5].reviews ?? [];
      const nextPayments = payloads[6].payments ?? [];

      setOverview(nextOverview);
      setSettings(nextSettings);
      setCommissionDraft(String(nextSettings?.commissionRatePercent ?? 12));
      setUsers(nextUsers);
      setListings(nextListings);
      setBookings(nextBookings);
      setReviews(nextReviews);
      setPayments(nextPayments);
      setListingNoteDrafts(
        Object.fromEntries(
          nextListings.map((listing: AdminListing) => [
            listing.id,
            listing.moderationNote ?? "",
          ]),
        ),
      );
      setReviewNoteDrafts(
        Object.fromEntries(
          nextReviews.map((review: AdminReview) => [review.id, review.moderationNote ?? ""]),
        ),
      );
      storeToken(currentToken, "admin");
      setStatus("ready");
    } catch {
      setStatus("error");
      setMessage("Could not load admin panel");
    }
  }

  async function updateUserRole(userId: string, role: AdminUser["role"]) {
    setActionMessage("Updating user role...");

    try {
      const response = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ role }),
      });
      const data = await response.json();

      if (!response.ok) {
        setActionMessage(data.message ?? "Could not update role");
        return;
      }

      setUsers((current) =>
        current.map((user) => (user.id === userId ? { ...user, role } : user)),
      );
      setActionMessage("User role updated");
    } catch {
      setActionMessage("Could not update role");
    }
  }

  async function updateUserModeration(
    userId: string,
    patch: Partial<Pick<AdminUser, "isVerified" | "isSuspended" | "isBanned">>,
  ) {
    setActionMessage("Updating user moderation...");

    try {
      const response = await fetch(`${API_BASE}/admin/users/${userId}/moderation`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify(patch),
      });
      const data = await response.json();

      if (!response.ok) {
        setActionMessage(data.message ?? "Could not update user moderation");
        return;
      }

      setUsers((current) =>
        current.map((user) => (user.id === userId ? data.user : user)),
      );
      setActionMessage("User moderation updated");
    } catch {
      setActionMessage("Could not update user moderation");
    }
  }

  async function updateListingStatus(
    listingId: string,
    statusValue: AdminListing["status"],
  ) {
    setActionMessage("Updating listing status...");

    try {
      const response = await fetch(`${API_BASE}/admin/listings/${listingId}/status`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({
          status: statusValue,
          moderationNote: listingNoteDrafts[listingId] || null,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setActionMessage(data.message ?? "Could not update listing");
        return;
      }

      setListings((current) =>
        current.map((listing) =>
          listing.id === listingId
            ? {
                ...listing,
                moderationNote: data.listing?.moderationNote ?? listing.moderationNote,
                status: statusValue,
              }
            : listing,
        ),
      );
      setActionMessage("Listing status updated");
    } catch {
      setActionMessage("Could not update listing");
    }
  }

  async function updateReviewModeration(
    reviewId: string,
    moderationStatus: AdminReview["moderationStatus"],
  ) {
    setActionMessage("Updating review moderation...");

    try {
      const response = await fetch(`${API_BASE}/admin/reviews/${reviewId}/moderation`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({
          moderationNote: reviewNoteDrafts[reviewId] || null,
          moderationStatus,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setActionMessage(data.message ?? "Could not update review moderation");
        return;
      }

      setReviews((current) =>
        current.map((review) =>
          review.id === reviewId
            ? {
                ...review,
                moderationNote: data.review?.moderationNote ?? review.moderationNote,
                moderationStatus,
              }
            : review,
        ),
      );
      setActionMessage("Review moderation updated");
    } catch {
      setActionMessage("Could not update review moderation");
    }
  }

  async function updateCommissionRate() {
    setActionMessage("Updating commission rate...");

    try {
      const response = await fetch(`${API_BASE}/admin/settings`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({
          commissionRatePercent: Number(commissionDraft),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setActionMessage(data.message ?? "Could not update commission rate");
        return;
      }

      setSettings(data.settings);
      setOverview((current) =>
        current
          ? {
              ...current,
              finance: {
                ...current.finance,
                commissionRatePercent: data.settings.commissionRatePercent,
                estimatedCommissionRevenue: Number(
                  (
                    (current.finance.paidRevenue * data.settings.commissionRatePercent) /
                    100
                  ).toFixed(2),
                ),
              },
            }
          : current,
      );
      setActionMessage("Commission rate updated");
    } catch {
      setActionMessage("Could not update commission rate");
    }
  }

  function clearToken() {
    clearStoredTokens();
    setToken("");
    setStatus("idle");
    setMessage("");
    setOverview(null);
    setSettings(null);
    setUsers([]);
    setListings([]);
    setBookings([]);
    setReviews([]);
    setPayments([]);
    setActionMessage("");
    setListingNoteDrafts({});
    setReviewNoteDrafts({});
  }

  function renderOverview() {
    if (!overview) return null;

    return (
      <>
        <section className="dashboard-section">
          <div className="dashboard-stats">
            <AdminStat label="Users" value={overview.stats.users} />
            <AdminStat label="Listings" value={overview.stats.listings} />
            <AdminStat label="Bookings" value={overview.stats.bookings} />
            <AdminStat label="Reviews" value={overview.stats.reviews} />
            <AdminStat label="Payments" value={overview.stats.payments} />
            <AdminStat label="Published" value={overview.stats.publishedListings} />
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-header">
            <h2>Platform analytics</h2>
            {actionMessage ? <span className="dashboard-section-note">{actionMessage}</span> : null}
          </div>
          <div className="dashboard-grid">
            <div className="dashboard-card dashboard-overview-card">
              <div className="dashboard-card-top">
                <strong>Revenue</strong>
                <span className="badge badge-published">Finance</span>
              </div>
              <p className="dashboard-price">
                Gross bookings: ${overview.finance.grossBookingRevenue.toFixed(2)}
              </p>
              <p className="dashboard-meta">
                Paid revenue: ${overview.finance.paidRevenue.toFixed(2)}
              </p>
              <p className="dashboard-meta">
                Estimated commission: ${overview.finance.estimatedCommissionRevenue.toFixed(2)}
              </p>
            </div>

            <div className="dashboard-card dashboard-overview-card">
              <div className="dashboard-card-top">
                <strong>Moderation snapshot</strong>
                <span className="badge badge-draft">Trust</span>
              </div>
              <p className="dashboard-meta">Verified users: {overview.moderation.verifiedUsers}</p>
              <p className="dashboard-meta">Suspended users: {overview.moderation.suspendedUsers}</p>
              <p className="dashboard-meta">Banned users: {overview.moderation.bannedUsers}</p>
              <p className="dashboard-meta">Hidden reviews: {overview.moderation.hiddenReviews}</p>
            </div>

            <div className="dashboard-card dashboard-overview-card">
              <div className="dashboard-card-top">
                <strong>Booking mix</strong>
                <span className="badge badge-draft">Operations</span>
              </div>
              <p className="dashboard-meta">Pending: {overview.bookingStatus.pending}</p>
              <p className="dashboard-meta">Confirmed: {overview.bookingStatus.confirmed}</p>
              <p className="dashboard-meta">Cancelled: {overview.bookingStatus.cancelled}</p>
              <p className="dashboard-meta">Paid payments: {overview.paymentStatus.paid}</p>
            </div>
          </div>

          <div className="dashboard-grid" style={{ marginTop: 16 }}>
            <div className="dashboard-card">
              <div className="dashboard-card-top">
                <strong>Commission rate</strong>
                <span className="badge badge-published">Settings</span>
              </div>
              <p className="dashboard-meta">
                Current: {settings?.commissionRatePercent ?? overview.finance.commissionRatePercent}%
              </p>
              <div className="admin-action-row">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={commissionDraft}
                  onChange={(event) => setCommissionDraft(event.target.value)}
                  className="filter-input"
                />
                <button type="button" className="clear-btn" onClick={updateCommissionRate}>
                  Save commission
                </button>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="dashboard-card-top">
                <strong>Occupancy trend</strong>
                <span className="badge badge-draft">Last 6 months</span>
              </div>
              <div className="admin-trend-list">
                {overview.trends.map((trend) => (
                  <div key={trend.month} className="admin-trend-row">
                    <span>{trend.month}</span>
                    <span>{trend.bookings} bookings</span>
                    <span>{trend.occupancyRate}% occupancy</span>
                    <span>${trend.paidRevenue.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  function renderUsers() {
    return (
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <h2>Users</h2>
          {actionMessage ? <span className="dashboard-section-note">{actionMessage}</span> : null}
        </div>
        <div className="dashboard-grid">
          {users.map((user) => (
            <div key={user.id} className="dashboard-card">
              <div className="dashboard-card-top">
                <strong>{user.name ?? "Unnamed user"}</strong>
                <span className={statusClass(user.role.toUpperCase())}>{user.role}</span>
              </div>
              <p className="dashboard-meta">{user.email}</p>
              <p className="dashboard-meta">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
              <p className="dashboard-meta">
                {user.isVerified ? "Verified" : "Unverified"} · {user.isSuspended ? "Suspended" : "Active"} ·{" "}
                {user.isBanned ? "Banned" : "Not banned"}
              </p>
              <div className="admin-action-row">
                <button type="button" className="clear-btn" onClick={() => updateUserRole(user.id, "guest")}>
                  Guest
                </button>
                <button type="button" className="clear-btn" onClick={() => updateUserRole(user.id, "host")}>
                  Host
                </button>
                <button type="button" className="clear-btn" onClick={() => updateUserRole(user.id, "admin")}>
                  Admin
                </button>
              </div>
              <div className="admin-action-row">
                <button
                  type="button"
                  className="clear-btn"
                  onClick={() => updateUserModeration(user.id, { isVerified: !user.isVerified })}
                >
                  {user.isVerified ? "Unverify" : "Verify"}
                </button>
                <button
                  type="button"
                  className="clear-btn"
                  onClick={() => updateUserModeration(user.id, { isSuspended: !user.isSuspended })}
                >
                  {user.isSuspended ? "Unsuspend" : "Suspend"}
                </button>
                <button
                  type="button"
                  className="clear-btn"
                  onClick={() => updateUserModeration(user.id, { isBanned: !user.isBanned })}
                >
                  {user.isBanned ? "Unban" : "Ban"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderListings() {
    return (
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <h2>Listings</h2>
          {actionMessage ? <span className="dashboard-section-note">{actionMessage}</span> : null}
        </div>
        <div className="dashboard-grid">
          {listings.map((listing) => (
            <div key={listing.id} className="dashboard-card">
              <div className="dashboard-card-top">
                <Link href={`/listings/${listing.id}`}>{listing.title}</Link>
                <span className={statusClass(listing.status)}>{listing.status}</span>
              </div>
              <p className="dashboard-meta">Host: {listing.host.name ?? listing.host.email}</p>
              <p className="dashboard-meta">
                {listing.city || listing.country
                  ? [listing.city, listing.country].filter(Boolean).join(", ")
                  : "Location not set"}
              </p>
              <p className="dashboard-meta">
                {listing._count.bookings} bookings · {listing._count.reviews} reviews
              </p>
              <p className="dashboard-price">${listing.pricePerDay}/night</p>
              <textarea
                className="admin-note-input"
                rows={2}
                placeholder="Moderation note for this listing"
                value={listingNoteDrafts[listing.id] ?? ""}
                onChange={(event) =>
                  setListingNoteDrafts((current) => ({
                    ...current,
                    [listing.id]: event.target.value,
                  }))
                }
              />
              <div className="admin-action-row">
                <button type="button" className="clear-btn" onClick={() => updateListingStatus(listing.id, "DRAFT")}>
                  Draft
                </button>
                <button type="button" className="clear-btn" onClick={() => updateListingStatus(listing.id, "PUBLISHED")}>
                  Publish
                </button>
                <button type="button" className="clear-btn" onClick={() => updateListingStatus(listing.id, "ARCHIVED")}>
                  Archive
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderBookings() {
    return (
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <h2>Bookings</h2>
        </div>
        <div className="dashboard-grid">
          {bookings.map((booking) => (
            <div key={booking.id} className="dashboard-card">
              <div className="dashboard-card-top">
                <Link href={`/listings/${booking.listing.id}`}>{booking.listing.title}</Link>
                <span className={statusClass(booking.status)}>{booking.status}</span>
              </div>
              <p className="dashboard-meta">Guest: {booking.guest.name ?? booking.guest.email}</p>
              <p className="dashboard-meta">Host: {booking.listing.host.name ?? booking.listing.host.email}</p>
              <p className="dashboard-meta">
                {new Date(booking.checkIn).toLocaleDateString()} to {new Date(booking.checkOut).toLocaleDateString()}
              </p>
              <p className="dashboard-price">${booking.totalPrice} total</p>
              <p className="dashboard-meta">
                Payment: {booking.payment?.status ?? "NONE"}
                {booking.payment ? ` · ${booking.payment.currency.toUpperCase()} ${booking.payment.amountTotal}` : ""}
              </p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderReviews() {
    return (
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <h2>Reviews</h2>
          {actionMessage ? <span className="dashboard-section-note">{actionMessage}</span> : null}
        </div>
        <div className="dashboard-grid">
          {reviews.map((review) => (
            <div key={review.id} className="dashboard-card">
              <div className="dashboard-card-top">
                <Link href={`/listings/${review.listing.id}`}>{review.listing.title}</Link>
                <span className="card-rating">★ {review.rating}</span>
              </div>
              <p className="dashboard-meta">By {review.author.name ?? review.author.email}</p>
              <p className="dashboard-meta">Status: {review.moderationStatus}</p>
              <p className="dashboard-comment">{review.comment ?? "No written comment."}</p>
              <textarea
                className="admin-note-input"
                rows={2}
                placeholder="Moderation note for this review"
                value={reviewNoteDrafts[review.id] ?? ""}
                onChange={(event) =>
                  setReviewNoteDrafts((current) => ({
                    ...current,
                    [review.id]: event.target.value,
                  }))
                }
              />
              <div className="admin-action-row">
                <button type="button" className="clear-btn" onClick={() => updateReviewModeration(review.id, "VISIBLE")}>
                  Show
                </button>
                <button type="button" className="clear-btn" onClick={() => updateReviewModeration(review.id, "HIDDEN")}>
                  Hide
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderPayments() {
    return (
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <h2>Payments</h2>
        </div>
        <div className="dashboard-grid">
          {payments.map((payment) => (
            <div key={payment.id} className="dashboard-card">
              <div className="dashboard-card-top">
                <Link href={`/listings/${payment.booking.listing.id}`}>{payment.booking.listing.title}</Link>
                <span className={statusClass(payment.status)}>{payment.status}</span>
              </div>
              <p className="dashboard-meta">Guest: {payment.guest.name ?? payment.guest.email}</p>
              <p className="dashboard-price">
                {payment.currency.toUpperCase()} {payment.amountTotal}
              </p>
              <p className="dashboard-meta">Booking ID: {payment.booking.id}</p>
              <p className="dashboard-meta">Session: {payment.stripeCheckoutSessionId ?? "Not attached"}</p>
              <p className="dashboard-meta">Created {new Date(payment.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderSettings() {
    return (
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <h2>Settings</h2>
          {actionMessage ? <span className="dashboard-section-note">{actionMessage}</span> : null}
        </div>
        <div className="dashboard-grid">
          <div className="dashboard-card dashboard-overview-card">
            <div className="dashboard-card-top">
              <strong>Commission rate</strong>
              <span className="badge badge-published">Platform</span>
            </div>
            <p className="dashboard-meta">
              Current: {settings?.commissionRatePercent ?? overview?.finance.commissionRatePercent ?? 12}%
            </p>
            <div className="admin-action-row">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={commissionDraft}
                onChange={(event) => setCommissionDraft(event.target.value)}
                className="filter-input"
              />
              <button type="button" className="clear-btn" onClick={updateCommissionRate}>
                Save commission
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  function renderTabContent() {
    switch (activeTab) {
      case "overview":
        return renderOverview();
      case "users":
        return renderUsers();
      case "listings":
        return renderListings();
      case "bookings":
        return renderBookings();
      case "reviews":
        return renderReviews();
      case "payments":
        return renderPayments();
      case "settings":
        return renderSettings();
      default:
        return null;
    }
  }

  return (
    <main className="container dashboard-page admin-page">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Admin workspace</p>
          <p className="subtitle">
            Review analytics, trust operations, catalog quality, and platform finance from one control center.
          </p>
        </div>

        {overview ? (
          <div className="dashboard-hero-actions">
            <button
              type="button"
              className="clear-btn"
              onClick={() => void loadAdmin(token)}
              disabled={status === "loading"}
            >
              {status === "loading" ? (
                <span className="dashboard-button-loading">
                  <WindowsLoader />
                  Refreshing...
                </span>
              ) : (
                "Refresh workspace"
              )}
            </button>
            <button type="button" className="clear-btn" onClick={clearToken}>
              Sign out
            </button>
          </div>
        ) : null}
      </section>

      {!token.trim() ? (
        <section className="dashboard-auth-card dashboard-empty-shell">
          <p className="eyebrow">Secure access</p>
          <h2>Sign in with an admin session.</h2>
          <p className="dashboard-comment">
            The admin area now opens automatically from your saved session instead of exposing a token field.
          </p>
          <div className="dashboard-inline-actions">
            <Link href="/auth" className="hero-primary">
              Sign in
            </Link>
            <Link href="/" className="hero-secondary">
              Back to home
            </Link>
          </div>
        </section>
      ) : status === "loading" && !overview ? (
        <section className="dashboard-auth-card dashboard-empty-shell">
          <p className="eyebrow">Loading workspace</p>
          <div className="dashboard-loading-panel">
            <WindowsLoader label="Preparing admin workspace..." />
          </div>
          <p className="dashboard-comment">
            We are loading analytics, moderation queues, and platform activity.
          </p>
        </section>
      ) : overview ? (
        <>
          <section className="dashboard-section">
            <div className="dashboard-account-card dashboard-account-shell">
              <div>
                <p className="eyebrow">Platform control</p>
                <h2>Admin workspace</h2>
                <p className="dashboard-account-meta">
                  Manage users, listings, bookings, reviews, payments, and commission settings.
                </p>
              </div>
              <div className="dashboard-account-side">
                <span className="badge badge-published">Admin</span>
                <p className="dashboard-section-note">Session loaded automatically from saved access.</p>
              </div>
            </div>

            <div className="dashboard-tab-bar">
              {adminTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={tab.id === activeTab ? "dashboard-tab active" : "dashboard-tab"}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span>{tab.label}</span>
                  {"count" in tab && tab.count != null ? (
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
          <h2>We could not open the admin workspace.</h2>
          <p className="dashboard-comment">{message || "Please sign in again with an admin account."}</p>
          <div className="dashboard-inline-actions">
            <Link href="/auth" className="hero-primary">
              Sign in again
            </Link>
            <button type="button" className="clear-btn" onClick={clearToken}>
              Clear session
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
