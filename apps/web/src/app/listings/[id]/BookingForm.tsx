"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { API_BASE } from "../../../lib/api";
import { getStoredToken } from "../../../lib/auth";

type Props = {
  listingId: string;
  pricePerDay: number;
  cleaningFee: number;
  minimumStayNights: number;
  instantBook: boolean;
};

type BookingQuote = {
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

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24),
  );
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function BookingForm({
  listingId,
  pricePerDay,
  cleaningFee,
  minimumStayNights,
  instantBook,
}: Props) {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [quoteStatus, setQuoteStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");
  const [quoteMessage, setQuoteMessage] = useState("");
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [bookingMode, setBookingMode] = useState<"INSTANT" | "REQUEST">(
    instantBook ? "INSTANT" : "REQUEST",
  );
  const [cancellationPolicy, setCancellationPolicy] = useState("MODERATE");

  useEffect(() => {
    setToken(getStoredToken());
  }, []);

  const nights = checkIn && checkOut ? daysBetween(checkIn, checkOut) : 0;
  const stayTooShort = nights > 0 && nights < minimumStayNights;

  useEffect(() => {
    let cancelled = false;

    async function loadQuote() {
      if (!checkIn || !checkOut || nights < 1) {
        setQuote(null);
        setAvailable(null);
        setQuoteMessage("");
        setQuoteStatus("idle");
        return;
      }

      if (stayTooShort) {
        setQuote(null);
        setAvailable(false);
        setQuoteStatus("error");
        setQuoteMessage(
          `This listing requires at least ${minimumStayNights} night${minimumStayNights > 1 ? "s" : ""}.`,
        );
        return;
      }

      setQuoteStatus("loading");
      setQuoteMessage("");

      try {
        const res = await fetch(
          `${API_BASE}/listings/${listingId}/quote?checkIn=${checkIn}&checkOut=${checkOut}`,
        );
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setQuote(null);
          setAvailable(false);
          setQuoteStatus("error");
          setQuoteMessage(data.message ?? "Unable to calculate price");
          return;
        }

        setQuote(data.quote ?? null);
        setAvailable(data.available ?? false);
        setBookingMode(data.bookingMode ?? "REQUEST");
        setCancellationPolicy(data.cancellationPolicy ?? "MODERATE");
        setQuoteStatus("ready");
        setQuoteMessage(
          data.available ? "" : "Those dates are unavailable. Try another date range.",
        );
      } catch {
        if (cancelled) return;
        setQuote(null);
        setAvailable(null);
        setQuoteStatus("error");
        setQuoteMessage("Could not load a booking quote");
      }
    }

    loadQuote();

    return () => {
      cancelled = true;
    };
  }, [checkIn, checkOut, listingId, minimumStayNights, nights, stayTooShort]);

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) {
      setMessage("Paste your JWT token to book");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token.trim()}`,
        },
        body: JSON.stringify({ listingId, checkIn, checkOut }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.message ?? "Booking failed");
        return;
      }

      setStatus("success");
      setMessage(
        `Booked! ${data.nights} night(s) - $${data.booking.totalPrice} total. Status: ${data.booking.status}`,
      );
    } catch {
      setStatus("error");
      setMessage("Network error");
    }
  }

  return (
    <div className="booking-form">
      <p className="eyebrow">Reserve this stay</p>
      <h3>Your stay summary</h3>

      <p className="dashboard-meta" style={{ marginTop: 0 }}>
        From ${pricePerDay.toFixed(2)}/night
        {cleaningFee > 0 ? ` + $${cleaningFee.toFixed(2)} cleaning fee` : ""}
        {instantBook ? " · Instant confirmation available" : " · Host approval required"}
      </p>

      <div className="booking-dates">
        <label className="booking-field">
          <span>Check-in</span>
          <input
            type="date"
            min={todayStr()}
            value={checkIn}
            onChange={(e) => {
              setCheckIn(e.target.value);
              setAvailable(null);
            }}
          />
        </label>

        <label className="booking-field">
          <span>Check-out</span>
          <input
            type="date"
            min={checkIn || todayStr()}
            value={checkOut}
            onChange={(e) => {
              setCheckOut(e.target.value);
              setAvailable(null);
            }}
          />
        </label>
      </div>

      {nights > 0 && (
        <div className="booking-summary">
          <span>
            {nights} night{nights > 1 ? "s" : ""} selected
          </span>
          <span className="booking-total">
            {quote ? `$${quote.totalPrice.toFixed(2)}` : "Calculating..."}
          </span>
        </div>
      )}

      {quoteStatus === "loading" && (
        <p className="dashboard-meta" style={{ marginTop: 10 }}>
          Calculating dynamic price...
        </p>
      )}

      {quote && (
        <div className="booking-quote-breakdown">
          <div className="booking-quote-row">
            <span>Nightly subtotal</span>
            <span>${quote.nightlySubtotal.toFixed(2)}</span>
          </div>
          {quote.weeklyDiscountAmount > 0 && (
            <div className="booking-quote-row booking-quote-discount">
              <span>Weekly discount ({quote.weeklyDiscountPercent}%)</span>
              <span>-${quote.weeklyDiscountAmount.toFixed(2)}</span>
            </div>
          )}
          {quote.lastMinuteDiscountAmount > 0 && (
            <div className="booking-quote-row booking-quote-discount">
              <span>Last-minute discount ({quote.lastMinuteDiscountPercent}%)</span>
              <span>-${quote.lastMinuteDiscountAmount.toFixed(2)}</span>
            </div>
          )}
          {quote.cleaningFee > 0 && (
            <div className="booking-quote-row">
              <span>Cleaning fee</span>
              <span>${quote.cleaningFee.toFixed(2)}</span>
            </div>
          )}
          <div className="booking-quote-row booking-quote-total">
            <span>Total</span>
            <span>${quote.totalPrice.toFixed(2)}</span>
          </div>
          <p className="dashboard-meta" style={{ marginTop: 10 }}>
            {bookingMode === "INSTANT" ? "Instant confirmation" : "Booking request"} ·{" "}
            {cancellationPolicy.toLowerCase()} cancellation
          </p>
        </div>
      )}

      {available !== null && quoteStatus !== "error" && (
        <p className={available ? "avail-yes" : "avail-no"}>
          {available ? "Dates are available" : "Dates not available"}
        </p>
      )}

      {quoteMessage && (
        <p className={quoteStatus === "error" || available === false ? "avail-no" : "avail-yes"}>
          {quoteMessage}
        </p>
      )}

      <form onSubmit={handleBook}>
        <p className="dashboard-meta" style={{ marginTop: 8 }}>
          Sign in first if you have not joined yet. <Link href="/auth">Open account access</Link>.
        </p>

        <details className="booking-token-toggle">
          <summary>Manual token override</summary>
          <label className="booking-field" style={{ marginTop: 12 }}>
            <span>JWT Token</span>
            <input
              type="text"
              placeholder="Saved automatically from /auth"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
        </details>

        <button
          type="submit"
          className="book-btn"
          disabled={
            !checkIn ||
            !checkOut ||
            nights < 1 ||
            stayTooShort ||
            !quote ||
            available !== true ||
            status === "loading"
          }
        >
          {status === "loading"
            ? "Confirming..."
            : bookingMode === "INSTANT"
              ? "Reserve instantly"
              : "Request stay"}
        </button>
      </form>

      {message && (
        <p className={status === "success" ? "booking-success" : "booking-error"}>
          {message}
        </p>
      )}
    </div>
  );
}
