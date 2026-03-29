"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { API_BASE } from "../../lib/api";
import { getStoredToken, signOut, storeToken } from "../../lib/auth";
import Reveal from "../Reveal";
import MessageInbox from "./MessageInbox";
import NotificationPanel from "./NotificationPanel";
import PayBookingButton from "./PayBookingButton";

type MeResponse = {
  user: {
    email: string;
    id: string;
    name: string | null;
    role: "user" | "admin";
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

function compactBookingId(id: string) {
  if (id.length <= 16) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function paymentTagClass(paymentStatus: string | undefined) {
  const s = paymentStatus ?? "UNPAID";
  if (s === "PAID") return "dashboard-booking-tag dashboard-booking-tag--pay dashboard-booking-tag--pay-paid";
  if (s === "PENDING") return "dashboard-booking-tag dashboard-booking-tag--pay dashboard-booking-tag--pay-pending";
  if (s === "FAILED") return "dashboard-booking-tag dashboard-booking-tag--pay dashboard-booking-tag--pay-failed";
  return "dashboard-booking-tag dashboard-booking-tag--pay dashboard-booking-tag--pay-unpaid";
}

const DASH_TAB_QUERY = "tab";

type DashboardView = "overview" | "bookings" | "reviews" | "messages";

type DashboardNavTab = Exclude<DashboardView, "overview">;

const VIEW_TO_SLUG: Record<DashboardNavTab, string> = {
  bookings: "trips",
  reviews: "reviews",
  messages: "messages",
};

const SLUG_TO_VIEW: Record<string, DashboardNavTab> = {
  trips: "bookings",
  reviews: "reviews",
  messages: "messages",
};

function resolveViewFromSearchParams(tabSlug: string | null): DashboardView {
  if (!tabSlug || tabSlug.trim() === "") return "overview";
  return SLUG_TO_VIEW[tabSlug] ?? "overview";
}

export default function DashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabSlug = searchParams.get(DASH_TAB_QUERY);

  const [token, setToken] = useState("");
  const [user, setUser] = useState<MeResponse["user"] | null>(null);
  const [guestBookings, setGuestBookings] = useState<MyBooking[]>([]);
  const [myReviews, setMyReviews] = useState<ReviewSummary[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [copiedBookingId, setCopiedBookingId] = useState<string | null>(null);

  const activeView = useMemo(() => resolveViewFromSearchParams(tabSlug), [tabSlug]);

  useEffect(() => {
    const saved = getStoredToken();
    if (saved) {
      setToken(saved);
      void loadDashboard(saved);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (tabSlug == null || tabSlug === "") return;
    if (!SLUG_TO_VIEW[tabSlug]) {
      router.replace("/dashboard", { scroll: false });
    }
  }, [user, tabSlug, router]);

  const stats = useMemo(() => {
    return {
      guestBookings: guestBookings.length,
      reviews: myReviews.length,
    };
  }, [guestBookings.length, myReviews.length]);

  const dashboardTabs = useMemo(() => {
    return [
      { id: "bookings" as const, label: "Trips", count: stats.guestBookings },
      { id: "reviews" as const, label: "Reviews", count: stats.reviews },
      { id: "messages" as const, label: "Messages" },
    ];
  }, [stats.guestBookings, stats.reviews]);

  function navigateToView(next: DashboardView) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next === "overview") {
      sp.delete(DASH_TAB_QUERY);
    } else {
      sp.set(DASH_TAB_QUERY, VIEW_TO_SLUG[next]);
    }
    const qs = sp.toString();
    router.replace(qs ? `/dashboard?${qs}` : "/dashboard", { scroll: false });
  }

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

      const responses = await Promise.all([
        fetch(`${API_BASE}/my/bookings`, {
          headers: authHeaders(currentToken),
        }),
        fetch(`${API_BASE}/my/reviews`, {
          headers: authHeaders(currentToken),
        }),
      ]);
      const payloads = await Promise.all(responses.map((response) => response.json()));

      setGuestBookings(payloads[0].bookings ?? []);
      setMyReviews(payloads[1].reviews ?? []);

      storeToken(currentToken, currentUser.role);
      setStatus("ready");
    } catch {
      setStatus("error");
      setMessage("Could not load dashboard");
    }
  }

  async function copyBookingIdToClipboard(id: string) {
    const resetTimer = () =>
      window.setTimeout(() => {
        setCopiedBookingId((cur) => (cur === id ? null : cur));
      }, 2000);
    try {
      await navigator.clipboard.writeText(id);
      setCopiedBookingId(id);
      resetTimer();
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = id;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopiedBookingId(id);
        resetTimer();
      } catch {
        setActionMessage("Could not copy booking ID");
        window.setTimeout(() => setActionMessage(""), 2500);
      }
    }
  }

  async function runBookingAction(bookingId: string, action: "cancel") {
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

      setActionMessage("Booking cancelled");
      await loadDashboard(token);
    } catch {
      setActionMessage("Network error");
    }
  }

  function handleSignOut() {
    signOut();
    setToken("");
    setUser(null);
    setGuestBookings([]);
    setMyReviews([]);
    setStatus("idle");
    setMessage("");
    setActionMessage("");
    router.push("/");
    router.refresh();
  }

  function renderGuestBookings() {
    if (guestBookings.length === 0) {
      return <div className="empty dashboard-empty">No bookings yet.</div>;
    }

    return (
      <div className="dashboard-list">
        {guestBookings.map((booking, index) => {
          const payStatus = booking.payment?.status ?? "UNPAID";
          const dateLabel = `${new Date(booking.checkIn).toLocaleDateString()} – ${new Date(booking.checkOut).toLocaleDateString()}`;
          const idCopied = copiedBookingId === booking.id;
          return (
            <div key={booking.id} className="dashboard-list-row">
              <div className="dashboard-booking-line">
                <span className="dashboard-booking-no" aria-label={`Booking ${index + 1}`}>
                  {index + 1}
                </span>
                <Link
                  className="dashboard-booking-title"
                  href={`/listings/${booking.listing.id}`}
                  title={booking.listing.title}
                >
                  {booking.listing.title}
                </Link>
                <button
                  type="button"
                  className="dashboard-booking-tag dashboard-booking-tag--id dashboard-booking-id-copy"
                  title={`Copy full ID: ${booking.id}`}
                  aria-label={
                    idCopied
                      ? "Booking ID copied"
                      : `Copy booking ID ${booking.id}`
                  }
                  onClick={() => void copyBookingIdToClipboard(booking.id)}
                >
                  {idCopied ? "Copied" : `ID ${compactBookingId(booking.id)}`}
                </button>
                <span
                  className="dashboard-booking-tag dashboard-booking-tag--dates"
                  title={`${booking.checkIn} → ${booking.checkOut}`}
                >
                  {dateLabel}
                </span>
                <span className={paymentTagClass(booking.payment?.status)} title="Payment status">
                  {payStatus}
                </span>
                <span
                  className="dashboard-booking-tag dashboard-booking-tag--total"
                  title="Total for this stay"
                >
                  ${booking.totalPrice} total
                </span>
                <span className={statusClass(booking.status)} title="Booking status">
                  {booking.status}
                </span>
                <div className="dashboard-booking-line-actions">
                  {booking.payment?.status !== "PAID" &&
                  booking.status !== "CANCELLED" ? (
                    <PayBookingButton
                      bookingId={booking.id}
                      token={token}
                      layout="bookingRow"
                    />
                  ) : null}
                  {booking.status !== "CANCELLED" ? (
                    <button
                      type="button"
                      className="dashboard-danger-btn dashboard-booking-cancel-btn"
                      onClick={() => runBookingAction(booking.id, "cancel")}
                    >
                      Cancel booking
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderReviews() {
    if (myReviews.length === 0) {
      return <div className="empty dashboard-empty">No reviews yet.</div>;
    }

    return (
      <div className="dashboard-list">
        {myReviews.map((review) => (
          <div key={review.id} className="dashboard-list-row">
            <div className="dashboard-list-row-head">
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
    switch (activeView) {
      case "overview":
        return (
          <div className="dashboard-tab-stack">
            <Reveal>
              <NotificationPanel enabled={status === "ready"} token={token} />
            </Reveal>
            <Reveal>
              <section className="dashboard-section">
                <div className="dashboard-section-header">
                  <h2>Quick view</h2>
                  {actionMessage ? (
                    <span className="dashboard-section-note">{actionMessage}</span>
                  ) : null}
                </div>
                <div className="dashboard-quick-strip">
                  <div className="dashboard-quick-block">
                    <p className="eyebrow">Trips</p>
                    <h3 className="dashboard-quick-heading">Your upcoming stays</h3>
                    <p className="dashboard-comment">
                      Track reservations, payment state, and trip timing in one place.
                    </p>
                    <button
                      type="button"
                      className="dashboard-tab-ghost"
                      onClick={() => navigateToView("bookings")}
                    >
                      Open trips
                    </button>
                  </div>
                  {user?.role === "admin" ? (
                    <div className="dashboard-quick-block">
                      <p className="eyebrow">Operations</p>
                      <h3 className="dashboard-quick-heading">Listings and bookings</h3>
                      <p className="dashboard-comment">
                        Manage catalog, moderation, and reservations in the admin workspace.
                      </p>
                      <Link href="/admin" className="hero-inline-link">
                        Open admin panel
                      </Link>
                    </div>
                  ) : null}
                  <div className="dashboard-quick-block">
                    <p className="eyebrow">Conversations</p>
                    <h3 className="dashboard-quick-heading">Messages about your trips</h3>
                    <p className="dashboard-comment">
                      Open live threads, follow updates, and keep booking communication moving.
                    </p>
                    <button
                      type="button"
                      className="dashboard-tab-ghost"
                      onClick={() => navigateToView("messages")}
                    >
                      Open messages
                    </button>
                  </div>
                </div>
              </section>
            </Reveal>
          </div>
        );
      case "bookings":
        return (
          <Reveal>
            <section className="dashboard-section">{renderGuestBookings()}</section>
          </Reveal>
        );
      case "reviews":
        return (
          <Reveal>
            <section className="dashboard-section">
              <div className="dashboard-section-header">
                <h2>My reviews</h2>
              </div>
              {renderReviews()}
            </section>
          </Reveal>
        );
      case "messages":
        return (
          <Reveal>
            <MessageInbox enabled={status === "ready"} token={token} />
          </Reveal>
        );
      default:
        return null;
    }
  }

  return (
    <main className="container dashboard-page">
      <Reveal>
        <section className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <p className="eyebrow">Account hub</p>
            <p className="subtitle">
              Manage your stays, reviews, and trip messages from one place. Admins use the admin panel for listings and operations.
            </p>
          </div>
          {user ? (
            <nav className="dashboard-tab-bar dashboard-tab-bar--header" aria-label="Account sections">
              {dashboardTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={tab.id === activeView ? "dashboard-tab active" : "dashboard-tab"}
                  onClick={() => navigateToView(tab.id)}
                >
                  <span>{tab.label}</span>
                  {tab.count != null ? (
                    <span className="dashboard-tab-count">{tab.count}</span>
                  ) : null}
                </button>
              ))}
            </nav>
          ) : null}
        </section>
      </Reveal>

      {!token.trim() ? (
        <Reveal>
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
        </Reveal>
      ) : status === "loading" && !user ? (
        <Reveal>
          <section className="dashboard-auth-card dashboard-empty-shell">
            <p className="eyebrow">Loading account</p>
            <div className="dashboard-loading-panel">
              <WindowsLoader label="Preparing your dashboard..." />
            </div>
            <p className="dashboard-comment">
              We are loading your profile, reservations, and activity.
            </p>
          </section>
        </Reveal>
      ) : user ? (
        <>{renderTabContent()}</>
      ) : (
        <Reveal>
          <section className="dashboard-auth-card dashboard-empty-shell">
            <p className="eyebrow">Access issue</p>
            <h2>We could not open your dashboard.</h2>
            <p className="dashboard-comment">{message || "Please sign in again to continue."}</p>
            <div className="dashboard-inline-actions">
              <Link href="/auth" className="hero-primary">
                Sign in again
              </Link>
              <button type="button" className="clear-btn" onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          </section>
        </Reveal>
      )}
    </main>
  );
}
