import * as bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  signAccessToken,
  toAppRole,
  toDbRole,
  verifyTokenOrReply,
  requireRoles,
} from "../../lib/auth";
import { prisma } from "../../lib/prisma";

const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  role: z.enum(["guest", "host"]).optional(),
});

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function authRoutes(server: FastifyInstance) {
  const db = prisma as {
    user: {
      findUnique: (args: unknown) => Promise<any>;
      create: (args: unknown) => Promise<any>;
    };
  };

  server.post("/auth/register", async (request, reply) => {
    const parsed = registerBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid request body",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const data = parsed.data;
    const existing = await db.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });

    if (existing) {
      return reply.code(409).send({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await db.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
        role: toDbRole(data.role ?? "guest"),
      },
      select: { id: true, email: true, name: true, role: true },
    });

    const role = toAppRole(user.role);
    const token = signAccessToken({ sub: user.id, role });

    return reply.code(201).send({
      token,
      user: { id: user.id, email: user.email, name: user.name, role },
    });
  });

  server.post("/auth/login", async (request, reply) => {
    const parsed = loginBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid request body",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const user = await db.user.findUnique({
      where: { email: parsed.data.email },
    });

    if (!user) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);

    if (!ok) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }

    const role = toAppRole(user.role);
    const token = signAccessToken({ sub: user.id, role });

    return reply.send({
      token,
      user: { id: user.id, email: user.email, name: user.name, role },
    });
  });

  server.get("/auth/me", async (request, reply) => {
    const payload = verifyTokenOrReply(request, reply);
    if (!payload) return;

    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    return reply.send({
      user: { ...user, role: toAppRole(user.role) },
    });
  });

  server.get("/auth/admin/ping", async (request, reply) => {
    const payload = requireRoles(["admin"])(request, reply);
    if (!payload) return;

    return reply.send({ ok: true, role: payload.role });
  });
}
