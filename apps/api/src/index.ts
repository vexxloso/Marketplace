import { env } from "./env.js";
import { buildServer } from "./server.js";

const marketBootState = (globalThis as typeof globalThis & {
  __marketBootCount?: number;
});
marketBootState.__marketBootCount = (marketBootState.__marketBootCount ?? 0) + 1;

async function start() {
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
      hypothesisId: "H2-H3-H4",
      location: "apps/api/src/index.ts:start:entry",
      message: "API start invoked",
      data: {
        bootCount: marketBootState.__marketBootCount,
        pid: process.pid,
        port: env.PORT,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  const server = buildServer();

  try {
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
        hypothesisId: "H2-H3-H4",
        location: "apps/api/src/index.ts:start:before-listen",
        message: "About to call server.listen",
        data: {
          bootCount: marketBootState.__marketBootCount,
          pid: process.pid,
          port: env.PORT,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    await server.listen({
      host: "0.0.0.0",
      port: env.PORT,
    });
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
        hypothesisId: "H1-H2-H3-H4",
        location: "apps/api/src/index.ts:start:listen-success",
        message: "server.listen succeeded",
        data: {
          bootCount: marketBootState.__marketBootCount,
          pid: process.pid,
          port: env.PORT,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  } catch (error) {
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
        hypothesisId: "H1-H2-H3-H4",
        location: "apps/api/src/index.ts:start:listen-error",
        message: "server.listen failed",
        data: {
          bootCount: marketBootState.__marketBootCount,
          code: error instanceof Error ? (error as Error & { code?: string }).code ?? null : null,
          message: error instanceof Error ? error.message : "unknown error",
          pid: process.pid,
          port: env.PORT,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    server.log.error(error);
    process.exit(1);
  }
}

start();
