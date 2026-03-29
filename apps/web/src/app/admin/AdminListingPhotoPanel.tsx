"use client";

import { useCallback, useState } from "react";

import { API_BASE, apiAssetUrl } from "../../lib/api";

type ImageRow = { id: string; originalName: string; url: string };

export default function AdminListingPhotoPanel({
  listingId,
  token,
}: {
  listingId: string;
  token: string;
}) {
  const [images, setImages] = useState<ImageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  const loadImages = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API_BASE}/listings/${listingId}/images`);
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message ?? "Could not load images");
        return;
      }
      setImages(data.images ?? []);
    } catch {
      setMessage("Network error");
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !token.trim()) return;
    setLoading(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/listings/${listingId}/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token.trim()}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message ?? "Upload failed");
        return;
      }
      setImages((current) => [...current, data.image]);
      setFile(null);
    } catch {
      setMessage("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(imageId: string) {
    if (!token.trim()) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API_BASE}/listing-images/${imageId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message ?? "Delete failed");
        return;
      }
      setImages((current) => current.filter((img) => img.id !== imageId));
    } catch {
      setMessage("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <details
      className="admin-listing-photo-details"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          void loadImages();
        }
      }}
    >
      <summary className="admin-listing-photo-summary">Photos</summary>
      <div className="admin-listing-photo-body">
        {loading && images.length === 0 ? (
          <p className="dashboard-meta">Loading…</p>
        ) : null}
        <div className="admin-listing-photo-grid">
          {images.map((img) => (
            <div key={img.id} className="admin-listing-photo-thumb">
              <img
                src={apiAssetUrl(img.url) ?? ""}
                alt={img.originalName}
                className="admin-listing-photo-img"
              />
              <button
                type="button"
                className="clear-btn admin-listing-photo-remove"
                onClick={() => handleDelete(img.id)}
                disabled={loading}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={handleUpload} className="admin-listing-photo-upload">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <button type="submit" className="clear-btn" disabled={!file || loading || !token.trim()}>
            Upload
          </button>
        </form>
        {message ? (
          <p className="booking-error" style={{ marginTop: 8 }}>
            {message}
          </p>
        ) : null}
      </div>
    </details>
  );
}
