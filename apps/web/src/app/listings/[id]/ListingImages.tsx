"use client";

import { apiAssetUrl } from "../../../lib/api";

type ListingImage = {
  id: string;
  originalName: string;
  url: string;
};

type Props = {
  initialImages: ListingImage[];
};

export default function ListingImages({ initialImages }: Props) {
  return (
    <section className="listing-images-section">
      <h3>Photos</h3>

      {initialImages.length === 0 ? (
        <div className="image-empty">No photos yet.</div>
      ) : (
        <div className="image-grid">
          {initialImages.map((image) => (
            <div key={image.id} className="image-card">
              <img
                src={apiAssetUrl(image.url) ?? ""}
                alt={image.originalName}
                className="listing-image"
              />
              <div className="image-card-footer">
                <span className="image-name">{image.originalName}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
