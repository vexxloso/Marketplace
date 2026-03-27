import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { verifyAccessToken, verifyTokenOrReply } from "../../lib/auth";
import { createNotification } from "../../lib/notifications";
import { prisma } from "../../lib/prisma";
import { messagingRealtimeHub } from "../../lib/realtime";

const db = prisma as unknown as {
  booking: {
    findMany: (args: unknown) => Promise<any[]>;
    findUnique: (args: unknown) => Promise<any>;
  };
  message: {
    create: (args: unknown) => Promise<any>;
    findMany: (args: unknown) => Promise<any[]>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
  };
};

const createMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

const socketEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("subscribe"),
    bookingId: z.string().min(1),
  }),
  z.object({
    type: z.literal("typing"),
    bookingId: z.string().min(1),
    isTyping: z.boolean(),
  }),
]);

function formatParticipant(booking: any, userId: string) {
  if (booking.guestId === userId) {
    return {
      id: booking.listing.host.id,
      name: booking.listing.host.name,
      role: "host",
    };
  }

  return {
    id: booking.guest.id,
    name: booking.guest.name,
    role: "guest",
  };
}

function serializeMessage(message: any) {
  return {
    id: message.id,
    content: message.content,
    createdAt: message.createdAt,
    readAt: message.readAt ?? null,
    senderId: message.senderId,
    sender: message.sender,
  };
}

async function getAuthorizedBooking(bookingId: string, auth: { role: string; sub: string }) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      guestId: true,
      status: true,
      checkIn: true,
      checkOut: true,
      guest: { select: { id: true, name: true } },
      listing: {
        select: {
          id: true,
          title: true,
          hostId: true,
          host: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!booking) {
    return { error: "Booking not found", statusCode: 404 as const };
  }

  const isGuest = booking.guestId === auth.sub;
  const isHost = booking.listing.hostId === auth.sub;
  const isAdmin = auth.role === "admin";

  if (!isGuest && !isHost && !isAdmin) {
    return { error: "Not authorized", statusCode: 403 as const };
  }

  return {
    booking,
    isGuest,
    isHost,
    isAdmin,
  };
}

async function markBookingMessagesRead(bookingId: string, viewerId: string) {
  const unreadMessages = await db.message.findMany({
    where: {
      bookingId,
      readAt: null,
      senderId: { not: viewerId },
    },
    select: { id: true },
  });

  if (unreadMessages.length === 0) {
    return {
      messageIds: [] as string[],
      readAt: null as string | null,
    };
  }

  const readAt = new Date().toISOString();

  await db.message.updateMany({
    where: {
      id: { in: unreadMessages.map((message) => message.id) },
    },
    data: {
      readAt,
    },
  });

  return {
    messageIds: unreadMessages.map((message) => message.id),
    readAt,
  };
}

export async function messageRoutes(server: FastifyInstance) {
  server.get(
    "/ws/messages",
    {
      websocket: true,
    },
    async (connection: any, request) => {
      const query = request.query as { bookingId?: string; token?: string };
      const token = query.token?.trim();
      const auth = token ? verifyAccessToken(token) : null;

      if (!auth) {
        connection.socket.send(
          JSON.stringify({ type: "error", message: "Invalid or expired token" }),
        );
        connection.socket.close();
        return;
      }

      const connectionId = messagingRealtimeHub.register(auth.sub, (event) => {
        connection.socket.send(JSON.stringify(event));
      });

      if (query.bookingId) {
        const result = await getAuthorizedBooking(query.bookingId, auth);
        if ("error" in result) {
          connection.socket.send(JSON.stringify({ type: "error", message: result.error }));
        } else {
          messagingRealtimeHub.subscribe(connectionId, query.bookingId);
        }
      }

      connection.socket.on("message", async (rawPayload: Buffer | string) => {
        try {
          const parsed = socketEventSchema.safeParse(
            JSON.parse(rawPayload.toString()),
          );

          if (!parsed.success) {
            connection.socket.send(
              JSON.stringify({ type: "error", message: "Invalid websocket event" }),
            );
            return;
          }

          const result = await getAuthorizedBooking(parsed.data.bookingId, auth);
          if ("error" in result) {
            connection.socket.send(JSON.stringify({ type: "error", message: result.error }));
            return;
          }

          messagingRealtimeHub.subscribe(connectionId, parsed.data.bookingId);

          if (parsed.data.type === "typing") {
            messagingRealtimeHub.publishToBooking(
              parsed.data.bookingId,
              {
                type: "message:typing",
                bookingId: parsed.data.bookingId,
                isTyping: parsed.data.isTyping,
                userId: auth.sub,
              },
              { excludeUserId: auth.sub },
            );
          }
        } catch {
          connection.socket.send(
            JSON.stringify({ type: "error", message: "Could not process websocket event" }),
          );
        }
      });

      connection.socket.on("close", () => {
        messagingRealtimeHub.unregister(connectionId);
      });

      connection.socket.on("error", () => {
        messagingRealtimeHub.unregister(connectionId);
      });
    },
  );

  server.get("/my/messages", async (request, reply) => {
    const auth = verifyTokenOrReply(request, reply);
    if (!auth) return;

    const bookings = await db.booking.findMany({
      where: {
        OR: [{ guestId: auth.sub }, { listing: { hostId: auth.sub } }],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        guestId: true,
        status: true,
        checkIn: true,
        checkOut: true,
        guest: { select: { id: true, name: true } },
        listing: {
          select: {
            id: true,
            title: true,
            host: { select: { id: true, name: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            content: true,
            createdAt: true,
            readAt: true,
            senderId: true,
            sender: { select: { id: true, name: true } },
          },
        },
        unreadMessages: {
          where: {
            readAt: null,
            senderId: { not: auth.sub },
          },
          select: { id: true },
        },
      },
    });

    const conversations = bookings
      .map((booking) => ({
        bookingId: booking.id,
        bookingStatus: booking.status,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        lastMessage: booking.messages[0] ? serializeMessage(booking.messages[0]) : null,
        listing: booking.listing,
        participant: formatParticipant(booking, auth.sub),
        unreadCount: booking.unreadMessages.length,
      }))
      .sort((a, b) => {
        const aTime = a.lastMessage?.createdAt
          ? new Date(a.lastMessage.createdAt).getTime()
          : 0;
        const bTime = b.lastMessage?.createdAt
          ? new Date(b.lastMessage.createdAt).getTime()
          : 0;
        return bTime - aTime;
      });

    return reply.send({
      conversations,
    });
  });

  server.get("/bookings/:id/messages", async (request, reply) => {
    const auth = verifyTokenOrReply(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const result = await getAuthorizedBooking(id, auth);
    if ("error" in result) {
      return reply.code(result.statusCode ?? 403).send({ message: result.error });
    }
    const booking = result.booking;

    const messages = await db.message.findMany({
      where: { bookingId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        content: true,
        createdAt: true,
        readAt: true,
        senderId: true,
        sender: { select: { id: true, name: true } },
      },
    });

    return reply.send({
      booking: {
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        id: booking.id,
        listing: {
          id: booking.listing.id,
          title: booking.listing.title,
        },
        participant: formatParticipant(booking, auth.sub),
        status: booking.status,
      },
      messages: messages.map((message) => serializeMessage(message)),
    });
  });

  server.post("/bookings/:id/messages", async (request, reply) => {
    const auth = verifyTokenOrReply(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const parsed = createMessageSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid request body",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await getAuthorizedBooking(id, auth);
    if ("error" in result) {
      return reply.code(result.statusCode ?? 403).send({ message: result.error });
    }
    const booking = result.booking;
    const isGuest = result.isGuest;

    const message = await db.message.create({
      data: {
        bookingId: id,
        content: parsed.data.content.trim(),
        senderId: auth.sub,
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        readAt: true,
        senderId: true,
        sender: { select: { id: true, name: true } },
      },
    });

    const recipientId = isGuest ? booking.listing.hostId : booking.guestId;
    await createNotification({
      body: parsed.data.content.trim().slice(0, 120),
      link: "/dashboard",
      title: "New message received",
      type: "MESSAGE_RECEIVED",
      userId: recipientId,
    });

    const serializedMessage = serializeMessage(message);

    messagingRealtimeHub.publishToBooking(
      id,
      {
        type: "message:new",
        bookingId: id,
        message: serializedMessage,
      },
      { excludeUserId: auth.sub },
    );

    return reply.code(201).send({ message: serializedMessage });
  });

  server.patch("/bookings/:id/messages/read", async (request, reply) => {
    const auth = verifyTokenOrReply(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const result = await getAuthorizedBooking(id, auth);
    if ("error" in result) {
      return reply.code(result.statusCode ?? 403).send({ message: result.error });
    }

    const readResult = await markBookingMessagesRead(id, auth.sub);

    if (readResult.messageIds.length > 0 && readResult.readAt) {
      messagingRealtimeHub.publishToBooking(
        id,
        {
          type: "message:read",
          bookingId: id,
          messageIds: readResult.messageIds,
          readAt: readResult.readAt,
          userId: auth.sub,
        },
        { excludeUserId: auth.sub },
      );
    }

    return reply.send(readResult);
  });
}
