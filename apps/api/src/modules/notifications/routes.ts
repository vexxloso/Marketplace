import type { FastifyInstance } from "fastify";

import { verifyTokenOrReply } from "../../lib/auth";
import { prisma } from "../../lib/prisma";

const db = prisma as unknown as {
  notification: {
    count: (args: unknown) => Promise<number>;
    findMany: (args: unknown) => Promise<any[]>;
    findUnique: (args: unknown) => Promise<any>;
    update: (args: unknown) => Promise<any>;
    updateMany: (args: unknown) => Promise<any>;
  };
};

export async function notificationRoutes(server: FastifyInstance) {
  server.get("/my/notifications", async (request, reply) => {
    const auth = verifyTokenOrReply(request, reply);
    if (!auth) return;

    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId: auth.sub },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          body: true,
          createdAt: true,
          id: true,
          isRead: true,
          link: true,
          title: true,
          type: true,
        },
      }),
      db.notification.count({
        where: { userId: auth.sub, isRead: false },
      }),
    ]);

    return reply.send({ notifications, unreadCount });
  });

  server.patch("/notifications/:id/read", async (request, reply) => {
    const auth = verifyTokenOrReply(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const notification = await db.notification.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!notification) {
      return reply.code(404).send({ message: "Notification not found" });
    }

    if (notification.userId !== auth.sub) {
      return reply.code(403).send({ message: "Not authorized" });
    }

    const updated = await db.notification.update({
      where: { id },
      data: { isRead: true },
      select: { id: true, isRead: true },
    });

    return reply.send({ notification: updated });
  });

  server.patch("/my/notifications/read-all", async (request, reply) => {
    const auth = verifyTokenOrReply(request, reply);
    if (!auth) return;

    await db.notification.updateMany({
      where: { userId: auth.sub, isRead: false },
      data: { isRead: true },
    });

    return reply.send({ ok: true });
  });
}
