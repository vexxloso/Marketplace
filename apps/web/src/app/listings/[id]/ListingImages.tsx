"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { API_BASE, apiAssetUrl } from "../../../lib/api";
import { getStoredToken } from "../../../lib/auth";

type ListingImage = {
  id: string;
  originalName: string;
  url: string;
};

type Props = {
  initialImages: ListingImage[];
  listingId: string;
};

export default function ListingImages({ initialImages, listingId }: Props) {
  const [images, setImages] = useState(initialImages);
  const [file, setFile] = useState<File | null>(null);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    setToken(getStoredToken());
  }, []);

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setStatus("error");
      setMessage("Choose an image first");
      return;
    }

    if (!token.trim()) {
      setStatus("error");
      setMessage("Paste your JWT token to upload");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE}/listings/${listingId}/images`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.message ?? "Upload failed");
        return;
      }

      setImages((current) => [...current, data.image]);
      setFile(null);
      setStatus("success");
      setMessage("Image uploaded");
    } catch {
      setStatus("error");
      setMessage("Network error");
    }
  }

  async function handleDelete(imageId: string) {
    if (!token.trim()) {
      setStatus("error");
      setMessage("Paste your JWT token to delete");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE}/listing-images/${imageId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.message ?? "Delete failed");
        return;
      }

      setImages((current) => current.filter((image) => image.id !== imageId));
      setStatus("success");
      setMessage("Image deleted");
    } catch {
      setStatus("error");
      setMessage("Network error");
    }
  }

  return (
    <section className="listing-images-section">
      <h3>Photos</h3>

      {images.length === 0 ? (
        <div className="image-empty">No photos yet.</div>
      ) : (
        <div className="image-grid">
          {images.map((image) => (
            <div key={image.id} className="image-card">
              <img
                src={apiAssetUrl(image.url) ?? ""}
                alt={image.originalName}
                className="listing-image"
              />
              <div className="image-card-footer">
                <span className="image-name">{image.originalName}</span>
                <button
                  type="button"
                  className="image-delete-btn"
                  onClick={() => handleDelete(image.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <details className="image-upload-toggle">
        <summary>Manage photos</summary>
        <form onSubmit={handleUpload} className="image-upload-form">
          <label className="booking-field">
            <span>Select image</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
              }}
            />
          </label>

          <p className="dashboard-meta" style={{ marginTop: 8 }}>
            Sign in first if you need account access. <Link href="/auth">Open account access</Link>.
          </p>

          <details className="booking-token-toggle">
            <summary>Manual token override</summary>
            <label className="booking-field" style={{ marginTop: 12 }}>
              <span>JWT Token</span>
              <input
                type="text"
                placeholder="Saved automatically from /auth"
                value={token}
                onChange={(event) => setToken(event.target.value)}
              />
            </label>
          </details>

          <button
            type="submit"
            className="book-btn"
            disabled={!file || status === "loading"}
          >
            {status === "loading" ? "Uploading..." : "Upload image"}
          </button>

          {message ? (
            <p className={status === "success" ? "booking-success" : "booking-error"}>
              {message}
            </p>
          ) : null}
        </form>
      </details>
    </section>
  );
}
