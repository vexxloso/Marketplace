type OutboundEvent =
  | {
      type: "connection:ready";
      userId: string;
    }
  | {
      type: "message:new";
      bookingId: string;
      message: unknown;
    }
  | {
      type: "message:typing";
      bookingId: string;
      isTyping: boolean;
      userId: string;
    }
  | {
      type: "message:read";
      bookingId: string;
      messageIds: string[];
      readAt: string;
      userId: string;
    }
  | {
      type: "subscription:confirmed";
      bookingId: string;
    }
  | {
      type: "error";
      message: string;
    };

type ConnectionRecord = {
  id: string;
  send: (event: OutboundEvent) => void;
  subscriptions: Set<string>;
  userId: string;
};

function createConnectionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

class MessagingRealtimeHub {
  private bookingConnections = new Map<string, Set<string>>();
  private connections = new Map<string, ConnectionRecord>();
  private userConnections = new Map<string, Set<string>>();

  register(userId: string, send: (event: OutboundEvent) => void) {
    const id = createConnectionId();
    this.connections.set(id, {
      id,
      send,
      subscriptions: new Set(),
      userId,
    });

    const userSet = this.userConnections.get(userId) ?? new Set<string>();
    userSet.add(id);
    this.userConnections.set(userId, userSet);

    send({ type: "connection:ready", userId });

    return id;
  }

  unregister(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    for (const bookingId of connection.subscriptions) {
      const set = this.bookingConnections.get(bookingId);
      if (!set) continue;
      set.delete(connectionId);
      if (set.size === 0) {
        this.bookingConnections.delete(bookingId);
      }
    }

    const userSet = this.userConnections.get(connection.userId);
    if (userSet) {
      userSet.delete(connectionId);
      if (userSet.size === 0) {
        this.userConnections.delete(connection.userId);
      }
    }

    this.connections.delete(connectionId);
  }

  subscribe(connectionId: string, bookingId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.subscriptions.add(bookingId);
    const set = this.bookingConnections.get(bookingId) ?? new Set<string>();
    set.add(connectionId);
    this.bookingConnections.set(bookingId, set);
    connection.send({ type: "subscription:confirmed", bookingId });
  }

  publishToBooking(
    bookingId: string,
    event: OutboundEvent,
    options?: { excludeUserId?: string },
  ) {
    const set = this.bookingConnections.get(bookingId);
    if (!set) return;

    for (const connectionId of set) {
      const connection = this.connections.get(connectionId);
      if (!connection) continue;
      if (options?.excludeUserId && connection.userId === options.excludeUserId) {
        continue;
      }
      connection.send(event);
    }
  }
}

export const messagingRealtimeHub = new MessagingRealtimeHub();
