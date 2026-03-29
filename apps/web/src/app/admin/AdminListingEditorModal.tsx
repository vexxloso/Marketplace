"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const POLICIES = ["FLEXIBLE", "MODERATE", "STRICT"] as const;
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

type FormState = {
  title: string;
  description: string;
  addressLine: string;
  city: string;
  state: string;
  country: string;
  latitude: string;
  longitude: string;
  pricePerDay: string;
  weekendPrice: string;
  cleaningFee: string;
  minimumStayNights: string;
  instantBook: boolean;
  cancellationPolicy: (typeof POLICIES)[number];
  lastMinuteDiscountPercent: string;
  weeklyDiscountPercent: string;
  seasonalRatesJson: string;
  status: (typeof STATUSES)[number];
};

function emptyForm(): FormState {
  return {
    title: "",
    description: "",
    addressLine: "",
    city: "",
    state: "",
    country: "",
    latitude: "",
    longitude: "",
    pricePerDay: "",
    weekendPrice: "",
    cleaningFee: "0",
    minimumStayNights: "1",
    instantBook: true,
    cancellationPolicy: "MODERATE",
    lastMinuteDiscountPercent: "0",
    weeklyDiscountPercent: "0",
    seasonalRatesJson: "[]",
    status: "DRAFT",
  };
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token.trim()}`, "Content-Type": "application/json" };
}

export default function AdminListingEditorModal({
  apiBase,
  token,
  mode,
  listingId,
  open,
  onClose,
  onSaved,
}: {
  apiBase: string;
  token: string;
  mode: "create" | "edit";
  listingId: string | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fetchingListing, setFetchingListing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoadError("");
  }, [open, mode, listingId]);

  useEffect(() => {
    if (!open) return;

    if (mode === "create") {
      setForm(emptyForm());
      setFetchingListing(false);
      return;
    }

    if (!listingId) return;

    let cancelled = false;
    setFetchingListing(true);
    setLoadError("");

    void (async () => {
      try {
        const res = await fetch(`${apiBase}/listings/${listingId}`);
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) setLoadError(data.message ?? "Could not load listing");
          return;
        }
        const L = data.listing;
        if (cancelled || !L) return;

        const loc = L.location ?? {};
        const seasonal = (L.seasonalRates ?? []).map(
          (r: { startDate: string; endDate: string; pricePerDay: string | number }) => ({
            startDate: r.startDate,
            endDate: r.endDate,
            pricePerDay: Number(r.pricePerDay),
          }),
        );

        setForm({
          title: L.title ?? "",
          description: L.description ?? "",
          addressLine: loc.addressLine ?? "",
          city: loc.city ?? "",
          state: loc.state ?? "",
          country: loc.country ?? "",
          latitude: loc.latitude != null ? String(loc.latitude) : "",
          longitude: loc.longitude != null ? String(loc.longitude) : "",
          pricePerDay: L.pricePerDay != null ? String(L.pricePerDay) : "",
          weekendPrice: L.weekendPrice != null ? String(L.weekendPrice) : "",
          cleaningFee: L.cleaningFee != null ? String(L.cleaningFee) : "0",
          minimumStayNights: L.minimumStayNights != null ? String(L.minimumStayNights) : "1",
          instantBook: Boolean(L.instantBook),
          cancellationPolicy: (POLICIES as readonly string[]).includes(L.cancellationPolicy)
            ? L.cancellationPolicy
            : "MODERATE",
          lastMinuteDiscountPercent:
            L.lastMinuteDiscountPercent != null ? String(L.lastMinuteDiscountPercent) : "0",
          weeklyDiscountPercent: L.weeklyDiscountPercent != null ? String(L.weeklyDiscountPercent) : "0",
          seasonalRatesJson: JSON.stringify(seasonal, null, 0),
          status: (STATUSES as readonly string[]).includes(L.status) ? L.status : "DRAFT",
        });
      } catch {
        if (!cancelled) setLoadError("Could not load listing");
      } finally {
        if (!cancelled) setFetchingListing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, mode, listingId, apiBase]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoadError("");
    setSaving(true);

    let seasonalRates: { startDate: string; endDate: string; pricePerDay: number }[];
    try {
      const parsed = JSON.parse(form.seasonalRatesJson || "[]");
      if (!Array.isArray(parsed)) throw new Error("Seasonal rates must be a JSON array");
      seasonalRates = parsed.map((row: { startDate?: string; endDate?: string; pricePerDay?: number }) => {
        if (
          typeof row?.startDate !== "string" ||
          typeof row?.endDate !== "string" ||
          typeof row?.pricePerDay !== "number"
        ) {
          throw new Error("Each seasonal rate needs startDate, endDate, pricePerDay (number)");
        }
        return { startDate: row.startDate, endDate: row.endDate, pricePerDay: row.pricePerDay };
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Invalid seasonal rates JSON");
      setSaving(false);
      return;
    }

    const pricePerDay = Number(form.pricePerDay);
    if (!Number.isFinite(pricePerDay) || pricePerDay <= 0) {
      setLoadError("Price per day must be a positive number");
      setSaving(false);
      return;
    }

    const latStr = form.latitude.trim();
    const lngStr = form.longitude.trim();
    let latitude: number | null;
    let longitude: number | null;
    if (latStr || lngStr) {
      const la = Number(latStr);
      const lo = Number(lngStr);
      if (!Number.isFinite(la) || !Number.isFinite(lo)) {
        setLoadError("Latitude and longitude must both be valid numbers, or leave both empty");
        setSaving(false);
        return;
      }
      latitude = la;
      longitude = lo;
    } else {
      latitude = null;
      longitude = null;
    }

    const weekendPriceStr = form.weekendPrice.trim();
    const weekendPrice =
      weekendPriceStr === "" ? null : Number(weekendPriceStr);
    if (weekendPriceStr !== "" && (!Number.isFinite(weekendPrice) || (weekendPrice as number) <= 0)) {
      setLoadError("Weekend price must be empty or a positive number");
      setSaving(false);
      return;
    }

    const cleaningFee = Number(form.cleaningFee);
    const minimumStayNights = Math.floor(Number(form.minimumStayNights));
    const lastMinuteDiscountPercent = Math.floor(Number(form.lastMinuteDiscountPercent));
    const weeklyDiscountPercent = Math.floor(Number(form.weeklyDiscountPercent));

    if (!Number.isFinite(cleaningFee) || cleaningFee < 0) {
      setLoadError("Cleaning fee must be a number ≥ 0");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(minimumStayNights) || minimumStayNights < 1 || minimumStayNights > 365) {
      setLoadError("Minimum stay must be between 1 and 365");
      setSaving(false);
      return;
    }

    const body: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim(),
      addressLine: form.addressLine.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      country: form.country.trim() || null,
      latitude,
      longitude,
      pricePerDay,
      weekendPrice,
      cleaningFee,
      minimumStayNights,
      instantBook: form.instantBook,
      cancellationPolicy: form.cancellationPolicy,
      lastMinuteDiscountPercent,
      weeklyDiscountPercent,
      seasonalRates,
    };

    try {
      if (mode === "create") {
        const res = await fetch(`${apiBase}/listings`, {
          method: "POST",
          headers: authHeader(token),
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          setLoadError(data.message ?? "Could not create listing");
          return;
        }
        onSaved();
        onClose();
        return;
      }

      body.status = form.status;
      const res = await fetch(`${apiBase}/listings/${listingId}`, {
        method: "PUT",
        headers: authHeader(token),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.message ?? "Could not update listing");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setLoadError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="admin-listing-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-listing-editor-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="admin-listing-modal-panel">
        <div className="admin-listing-modal-head">
          <h2 id="admin-listing-editor-title">
            {mode === "create" ? "New listing" : "Edit listing"}
          </h2>
          <button type="button" className="admin-listing-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {fetchingListing ? (
          <p className="dashboard-comment">Loading listing…</p>
        ) : (
          <form className="admin-listing-modal-form" onSubmit={handleSubmit}>
            {loadError ? <p className="dashboard-section-note admin-listing-modal-error">{loadError}</p> : null}

            <label className="admin-listing-field">
              <span>Title</span>
              <input
                required
                minLength={3}
                maxLength={200}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="filter-input"
              />
            </label>

            <label className="admin-listing-field">
              <span>Description</span>
              <textarea
                required
                minLength={10}
                maxLength={5000}
                rows={4}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="filter-input"
              />
            </label>

            <div className="admin-listing-field-row">
              <label className="admin-listing-field">
                <span>Address</span>
                <input
                  value={form.addressLine}
                  onChange={(e) => setForm((f) => ({ ...f, addressLine: e.target.value }))}
                  className="filter-input"
                />
              </label>
            </div>
            <div className="admin-listing-field-row">
              <label className="admin-listing-field">
                <span>City</span>
                <input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="filter-input"
                />
              </label>
              <label className="admin-listing-field">
                <span>State / region</span>
                <input
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  className="filter-input"
                />
              </label>
              <label className="admin-listing-field">
                <span>Country</span>
                <input
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  className="filter-input"
                />
              </label>
            </div>
            <div className="admin-listing-field-row">
              <label className="admin-listing-field">
                <span>Latitude</span>
                <input
                  value={form.latitude}
                  onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                  className="filter-input"
                  placeholder="optional"
                />
              </label>
              <label className="admin-listing-field">
                <span>Longitude</span>
                <input
                  value={form.longitude}
                  onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                  className="filter-input"
                  placeholder="optional"
                />
              </label>
            </div>

            <div className="admin-listing-field-row">
              <label className="admin-listing-field">
                <span>Price / night</span>
                <input
                  required
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={form.pricePerDay}
                  onChange={(e) => setForm((f) => ({ ...f, pricePerDay: e.target.value }))}
                  className="filter-input"
                />
              </label>
              <label className="admin-listing-field">
                <span>Weekend price</span>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={form.weekendPrice}
                  onChange={(e) => setForm((f) => ({ ...f, weekendPrice: e.target.value }))}
                  className="filter-input"
                  placeholder="optional"
                />
              </label>
              <label className="admin-listing-field">
                <span>Cleaning fee</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.cleaningFee}
                  onChange={(e) => setForm((f) => ({ ...f, cleaningFee: e.target.value }))}
                  className="filter-input"
                />
              </label>
              <label className="admin-listing-field">
                <span>Min. nights</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={form.minimumStayNights}
                  onChange={(e) => setForm((f) => ({ ...f, minimumStayNights: e.target.value }))}
                  className="filter-input"
                />
              </label>
            </div>

            <div className="admin-listing-field-row">
              <label className="admin-listing-field">
                <span>Cancellation</span>
                <select
                  value={form.cancellationPolicy}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      cancellationPolicy: e.target.value as FormState["cancellationPolicy"],
                    }))
                  }
                  className="filter-input"
                >
                  {POLICIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-listing-field">
                <span>Last-minute discount %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.lastMinuteDiscountPercent}
                  onChange={(e) => setForm((f) => ({ ...f, lastMinuteDiscountPercent: e.target.value }))}
                  className="filter-input"
                />
              </label>
              <label className="admin-listing-field">
                <span>Weekly discount %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.weeklyDiscountPercent}
                  onChange={(e) => setForm((f) => ({ ...f, weeklyDiscountPercent: e.target.value }))}
                  className="filter-input"
                />
              </label>
            </div>

            {mode === "edit" ? (
              <label className="admin-listing-field">
                <span>Catalog status</span>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as FormState["status"] }))
                  }
                  className="filter-input"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="admin-listing-field admin-listing-field--check">
              <input
                type="checkbox"
                checked={form.instantBook}
                onChange={(e) => setForm((f) => ({ ...f, instantBook: e.target.checked }))}
              />
              <span>Instant book</span>
            </label>

            <label className="admin-listing-field">
              <span>Seasonal rates (JSON array)</span>
              <textarea
                rows={3}
                value={form.seasonalRatesJson}
                onChange={(e) => setForm((f) => ({ ...f, seasonalRatesJson: e.target.value }))}
                className="filter-input admin-listing-json"
                placeholder='[{"startDate":"2025-06-01","endDate":"2025-08-31","pricePerDay":199}]'
              />
            </label>

            <div className="admin-listing-modal-actions">
              <button type="button" className="clear-btn" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="hero-primary" disabled={saving}>
                {saving ? "Saving…" : mode === "create" ? "Create listing" : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
