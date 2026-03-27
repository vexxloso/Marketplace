import type { FastifyReply, FastifyRequest } from "fastify";
import * as jwt from "jsonwebtoken";

import { env } from "../env";

export type AppRole = "guest" | "host" | "admin";

export type AuthPayload = {
  sub: string;
  role: AppRole;
};

export function toAppRole(role: "GUEST" | "HOST" | "ADMIN"): AppRole {
  if (role === "ADMIN") return "admin";
  if (role === "HOST") return "host";
  return "guest";
}

export function toDbRole(role: AppRole): "GUEST" | "HOST" | "ADMIN" {
  if (role === "admin") return "ADMIN";
  if (role === "host") return "HOST";
  return "GUEST";
}

export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export function verifyTokenOrReply(
  request: FastifyRequest,
  reply: FastifyReply,
): AuthPayload | null {
  const raw = request.headers.authorization;

  if (!raw || !raw.startsWith("Bearer ")) {
    reply.code(401).send({ message: "Missing bearer token" });
    return null;
  }

  const token = raw.slice(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    reply.code(401).send({ message: "Invalid or expired token" });
    return null;
  }

  return payload;
}

export function requireRoles(roles: AppRole[]) {
  return (request: FastifyRequest, reply: FastifyReply): AuthPayload | null => {
    const payload = verifyTokenOrReply(request, reply);

    if (!payload) return null;

    if (!roles.includes(payload.role)) {
      reply.code(403).send({ message: "Forbidden: insufficient role" });
      return null;
    }

    return payload;
  };
}
