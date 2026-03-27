import { prisma } from "./prisma";

export type NotificationKind =
  | "BOOKING_CANCELLED"
  | "BOOKING_CONFIRMED"
  | "BOOKING_CREATED"
  | "MESSAGE_RECEIVED"
  | "REVIEW_RECEIVED";

const db = prisma as unknown as {
  notification: {
    create: (args: unknown) => Promise<any>;
  };
};

export async function createNotification(input: {
  body: string;
  link?: string;
  title: string;
  type: NotificationKind;
  userId: string;
}) {
  return db.notification.create({
    data: {
      body: input.body,
      isRead: false,
      link: input.link,
      title: input.title,
      type: input.type,
      userId: input.userId,
    },
  });
}
