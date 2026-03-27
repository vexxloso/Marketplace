import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const uploadsRootDir = path.resolve(currentDir, "..", "..", "uploads");
export const listingUploadsDir = path.join(uploadsRootDir, "listings");

export function ensureUploadDirs() {
  mkdirSync(listingUploadsDir, { recursive: true });
}

export function buildListingImageUrl(fileName: string) {
  return `/uploads/listings/${fileName}`;
}
