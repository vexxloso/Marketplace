"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { API_BASE } from "../../../lib/api";
import { getStoredToken } from "../../../lib/auth";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  author: { id: string; name: string | null };
};

type Props = {
  listingId: string;
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < rating ? "star-filled" : "star-empty"}>
          ★
        </span>
      ))}
    </span>
  );
}

const loginReturnUrl = (listingId: string) =>
  `/auth?mode=login&returnUrl=${encodeURIComponent(`/listings/${listingId}`)}`;

export default function ReviewSection({ listingId }: Props) {
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [submitMsg, setSubmitMsg] = useState("");

  useEffect(() => {
    fetchReviews();
  }, [listingId]);

  async function fetchReviews() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/listings/${listingId}/reviews`);
      const data = await res.json();
      setReviews(data.reviews ?? []);
      setAvgRating(data.avgRating ?? null);
      setTotal(data.pagination?.total ?? 0);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sessionToken = getStoredToken().trim();
    if (!sessionToken) {
      const returnUrl = `/listings/${listingId}`;
      router.push(`/auth?mode=login&returnUrl=${encodeURIComponent(returnUrl)}`);
      return;
    }

    setSubmitStatus("loading");
    setSubmitMsg("");

    try {
      const res = await fetch(`${API_BASE}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ listingId, rating, comment: comment || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitStatus("error");
        setSubmitMsg(data.message ?? "Failed to submit review");
        return;
      }

      setSubmitStatus("success");
      setSubmitMsg("Review submitted!");
      setComment("");
      setRating(5);
      fetchReviews();
    } catch {
      setSubmitStatus("error");
      setSubmitMsg("Network error");
    }
  }

  return (
    <div className="reviews-section">
      <div className="reviews-header">
        <h3>
          Reviews
          {avgRating !== null && (
            <span className="avg-badge">
              ★ {avgRating} <span className="review-count">({total})</span>
            </span>
          )}
        </h3>
      </div>

      {loading ? (
        <p style={{ color: "#6b7280" }}>Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No reviews yet.</p>
      ) : (
        <div className="reviews-list">
          {reviews.map((r) => (
            <div key={r.id} className="review-card">
              <div className="review-top">
                <Stars rating={r.rating} />
                <span className="review-author">
                  {r.author.name ?? "Anonymous"}
                </span>
                <span className="review-date">
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
              {r.comment && <p className="review-comment">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}

      <details
        className="review-form-toggle"
        onToggle={(e) => {
          const el = e.currentTarget;
          if (!el.open) return;
          if (!getStoredToken().trim()) {
            el.open = false;
            router.push(loginReturnUrl(listingId));
          }
        }}
      >
        <summary>Write a review</summary>
        <form onSubmit={handleSubmit} className="review-form">
          <label className="booking-field">
            <span>Rating</span>
            <div className="rating-picker">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={n <= rating ? "star-btn active" : "star-btn"}
                  onClick={() => setRating(n)}
                >
                  ★
                </button>
              ))}
            </div>
          </label>

          <label className="booking-field">
            <span>Comment (optional)</span>
            <textarea
              rows={3}
              placeholder="Share your experience..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={2000}
            />
          </label>

          <p className="dashboard-meta" style={{ marginTop: 8 }}>
            Sign in is required to submit a review. Opening this form sends you to sign in if you are
            not logged in.
          </p>

          <button
            type="submit"
            className="book-btn"
            disabled={submitStatus === "loading"}
          >
            {submitStatus === "loading" ? "Submitting..." : "Submit Review"}
          </button>

          {submitMsg && (
            <p className={submitStatus === "success" ? "booking-success" : "booking-error"}>
              {submitMsg}
            </p>
          )}
        </form>
      </details>
    </div>
  );
}
