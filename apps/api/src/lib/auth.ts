import type { FastifyReply, FastifyRequest } from "fastify";
import * as jwt from "jsonwebtoken";

import { env } from "../env.js";

export type AppRole = "user" | "admin";

export type AuthPayload = {
  sub: string;
  role: AppRole;
};

export function toAppRole(role: "USER" | "ADMIN"): AppRole {
  if (role === "ADMIN") return "admin";
  return "user";
}

export function toDbRole(role: AppRole): "USER" | "ADMIN" {
  if (role === "admin") return "ADMIN";
  return "USER";
}

export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): AuthPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string; role?: string };
    const raw = decoded.role;
    let role: AppRole;
    if (raw === "admin") role = "admin";
    else if (raw === "user") role = "user";
    else if (raw === "guest" || raw === "host") role = "user";
    else return null;
    return { sub: decoded.sub, role };
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
