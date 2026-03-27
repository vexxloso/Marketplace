"use client";

import { useState } from "react";

import { API_BASE } from "../../lib/api";

export default function PayBookingButton({
  bookingId,
  token,
}: {
  bookingId: string;
  token: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handlePay() {
    if (!token.trim()) {
      setStatus("error");
      setMessage("Missing token");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE}/payments/checkout-session`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookingId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.message ?? "Could not start payment");
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      setStatus("error");
      setMessage("Stripe did not return a checkout URL");
    } catch {
      setStatus("error");
      setMessage("Could not start payment");
    }
  }

  return (
    <div className="payment-action">
      <button
        type="button"
        className="dashboard-primary-btn"
        onClick={handlePay}
        disabled={status === "loading"}
      >
        {status === "loading" ? "Redirecting..." : "Pay now"}
      </button>
      {message ? <p className="booking-error">{message}</p> : null}
    </div>
  );
}
