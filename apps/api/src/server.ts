import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import fastifyRawBody from "fastify-raw-body";
import Fastify from "fastify";

import { env } from "./env.js";
import { adminRoutes } from "./modules/admin/routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { bookingRoutes } from "./modules/bookings/routes.js";
import { imageRoutes } from "./modules/images/routes.js";
import { listingRoutes } from "./modules/listings/routes.js";
import { messageRoutes } from "./modules/messages/routes.js";
import { notificationRoutes } from "./modules/notifications/routes.js";
import { paymentRoutes } from "./modules/payments/routes.js";
import { reviewRoutes } from "./modules/reviews/routes.js";
import { ensureUploadDirs, uploadsRootDir } from "./lib/uploads.js";

export function buildServer() {
  // #region agent log
  fetch("http://127.0.0.1:7526/ingest/067cdabc-a0da-4804-852a-ceb32478969f", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "d4db24",
    },
    body: JSON.stringify({
      sessionId: "d4db24",
      runId: "startup-probe",
      hypothesisId: "H2-H3",
      location: "apps/api/src/server.ts:buildServer",
      message: "buildServer invoked",
      data: {
        pid: process.pid,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  ensureUploadDirs();

  const server = Fastify({
    logger: env.NODE_ENV !== "test",
  });

  const allowedOrigins = new Set([
    env.APP_URL,
    "http://127.0.0.1:3001",
    "http://localhost:3001",
  ]);

  server.register(cors, {
    credentials: true,
    // Default is only GET,HEAD,POST — without PATCH/PUT/DELETE, browsers block
    // cross-origin preflight for admin PATCH (moderation, role, listings, etc.).
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed"), false);
    },
  });

  server.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 1,
    },
  });

  server.register(fastifyStatic, {
    prefix: "/uploads/",
    root: uploadsRootDir,
  });

  server.register(fastifyRawBody, {
    field: "rawBody",
    global: false,
    runFirst: true,
  });

  server.register(websocket);

  server.get("/health", async () => {
    return {
      status: "ok",
      service: "api",
    };
  });

  server.register(authRoutes);
  server.register(adminRoutes);
  server.register(listingRoutes);
  server.register(imageRoutes);
  server.register(bookingRoutes);
  server.register(messageRoutes);
  server.register(notificationRoutes);
  server.register(paymentRoutes);
  server.register(reviewRoutes);

  return server;
}
