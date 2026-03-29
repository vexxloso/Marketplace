import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { FastifyInstance } from "fastify";

import { requireRoles } from "../../lib/auth";
import { buildListingImageUrl, listingUploadsDir } from "../../lib/uploads";
import { prisma } from "../../lib/prisma";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const extensionByMimeType: Record<string, string> = {
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const db = prisma as unknown as {
  listing: {
    findUnique: (args: unknown) => Promise<any>;
  };
  listingImage: {
    create: (args: unknown) => Promise<any>;
    delete: (args: unknown) => Promise<any>;
    findMany: (args: unknown) => Promise<any[]>;
    findUnique: (args: unknown) => Promise<any>;
  };
};

function toImageResponse(image: {
  id: string;
  fileName: string;
  originalName: string;
  createdAt: Date | string;
}) {
  return {
    createdAt: image.createdAt,
    id: image.id,
    originalName: image.originalName,
    url: buildListingImageUrl(image.fileName),
  };
}

export async function imageRoutes(server: FastifyInstance) {
  server.get("/listings/:id/images", async (request, reply) => {
    const { id } = request.params as { id: string };

    const listing = await db.listing.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!listing) {
      return reply.code(404).send({ message: "Listing not found" });
    }

    const images = await db.listingImage.findMany({
      where: { listingId: id },
      orderBy: { createdAt: "asc" },
      select: {
        createdAt: true,
        fileName: true,
        id: true,
        originalName: true,
      },
    });

    return reply.send({
      images: images.map(toImageResponse),
    });
  });

  server.post("/listings/:id/images", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const listing = await db.listing.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!listing) {
      return reply.code(404).send({ message: "Listing not found" });
    }

    const file = await request.file();

    if (!file) {
      return reply.code(400).send({ message: "Image file is required" });
    }

    if (!allowedMimeTypes.has(file.mimetype)) {
      return reply.code(400).send({
        message: "Only jpeg, png, webp, or gif images are allowed",
      });
    }

    const buffer = await file.toBuffer();
    const extension =
      path.extname(file.filename ?? "").toLowerCase() ||
      extensionByMimeType[file.mimetype] ||
      ".bin";
    const fileName = `${id}-${Date.now()}-${randomUUID()}${extension}`;
    const filePath = path.join(listingUploadsDir, fileName);

    await writeFile(filePath, buffer);

    const image = await db.listingImage.create({
      data: {
        fileName,
        listingId: id,
        mimeType: file.mimetype,
        originalName: file.filename ?? fileName,
      },
      select: {
        createdAt: true,
        fileName: true,
        id: true,
        originalName: true,
      },
    });

    return reply.code(201).send({
      image: toImageResponse(image),
    });
  });

  server.delete("/listing-images/:imageId", async (request, reply) => {
    const auth = requireRoles(["admin"])(request, reply);
    if (!auth) return;

    const { imageId } = request.params as { imageId: string };

    const image = await db.listingImage.findUnique({
      where: { id: imageId },
      select: {
        fileName: true,
        id: true,
        listing: { select: { id: true } },
        originalName: true,
      },
    });

    if (!image) {
      return reply.code(404).send({ message: "Image not found" });
    }

    await db.listingImage.delete({
      where: { id: imageId },
    });

    await unlink(path.join(listingUploadsDir, image.fileName)).catch(() => {});

    return reply.send({
      image: {
        id: image.id,
        originalName: image.originalName,
      },
    });
  });
}
