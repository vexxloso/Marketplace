"use client";

import { useEffect, useRef, useState } from "react";

import { API_BASE, apiWebSocketUrl } from "../../lib/api";

type Conversation = {
  bookingId: string;
  bookingStatus: string;
  checkIn: string;
  checkOut: string;
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
    readAt?: string | null;
    senderId: string;
    sender: {
      id: string;
      name: string | null;
    };
  } | null;
  listing: {
    id: string;
    title: string;
  };
  participant: {
    id: string;
    name: string | null;
    role: "guest" | "property";
  };
  unreadCount: number;
};

type ThreadMessage = {
  id: string;
  content: string;
  createdAt: string;
  readAt?: string | null;
  senderId: string;
  sender: {
    id: string;
    name: string | null;
  };
};

type ThreadData = {
  booking: {
    id: string;
    status: string;
    checkIn: string;
    checkOut: string;
    listing: {
      id: string;
      title: string;
    };
    participant: {
      id: string;
      name: string | null;
      role: "guest" | "property";
    };
  };
  messages: ThreadMessage[];
};

type SocketEvent =
  | {
      type: "connection:ready";
      userId: string;
    }
  | {
      type: "message:new";
      bookingId: string;
      message: ThreadMessage;
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

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token.trim()}`,
    "Content-Type": "application/json",
  };
}

function peerRoleLabel(role: "guest" | "property") {
  return role === "property" ? "Property" : "Guest";
}

export default function MessageInbox({
  token,
  enabled,
}: {
  token: string;
  enabled: boolean;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [connectionState, setConnectionState] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const selectedBookingIdRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const typingSentRef = useRef(false);
  const readingBookingIdsRef = useRef(new Set<string>());

  useEffect(() => {
    selectedBookingIdRef.current = selectedBookingId;
  }, [selectedBookingId]);

  useEffect(() => {
    if (!enabled || !token.trim()) return;
    void loadConversations(token);
  }, [enabled, token]);

  useEffect(() => {
    if (!enabled || !token.trim() || !selectedBookingId) return;
    void loadThread(selectedBookingId, token);
  }, [enabled, selectedBookingId, token]);

  useEffect(() => {
    if (!enabled || !token.trim()) return;

    setConnectionState("connecting");
    const url = new URL(apiWebSocketUrl("/ws/messages"));
    url.searchParams.set("token", token.trim());

    const socket = new WebSocket(url.toString());
    socketRef.current = socket;

    socket.onopen = () => {
      setConnectionState("connected");
    };

    socket.onclose = () => {
      setConnectionState("disconnected");
      socketRef.current = null;
    };

    socket.onerror = () => {
      setConnectionState("disconnected");
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as SocketEvent;

        if (payload.type === "error") {
          setMessage(payload.message);
          return;
        }

        if (payload.type === "message:new") {
          applyIncomingMessage(payload.bookingId, payload.message);
          if (selectedBookingIdRef.current === payload.bookingId) {
            void markThreadRead(payload.bookingId, token);
          }
          return;
        }

        if (payload.type === "message:typing") {
          if (selectedBookingIdRef.current === payload.bookingId) {
            setTypingUserId(payload.isTyping ? payload.userId : null);
          }
          return;
        }

        if (payload.type === "message:read") {
          applyReadReceipt(payload.bookingId, payload.messageIds, payload.readAt);
        }
      } catch {
        setMessage("Could not process live chat update");
      }
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [enabled, token]);

  useEffect(() => {
    if (connectionState !== "connected" || !socketRef.current) return;

    for (const conversation of conversations) {
      sendSocketEvent({
        type: "subscribe",
        bookingId: conversation.bookingId,
      });
    }
  }, [connectionState, conversations]);

  useEffect(() => {
    if (!thread || !selectedBookingId || !token.trim()) return;
    void markThreadRead(selectedBookingId, token);
  }, [thread, selectedBookingId, token]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  async function loadConversations(currentToken: string) {
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE}/my/messages`, {
        headers: { Authorization: `Bearer ${currentToken.trim()}` },
      });
      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.message ?? "Could not load messages");
        return;
      }

      const nextConversations = data.conversations ?? [];
      setConversations(nextConversations);
      setSelectedBookingId((current) => current ?? nextConversations[0]?.bookingId ?? null);
      setStatus("idle");
    } catch {
      setStatus("error");
      setMessage("Could not load messages");
    }
  }

  async function loadThread(bookingId: string, currentToken: string) {
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE}/bookings/${bookingId}/messages`, {
        headers: { Authorization: `Bearer ${currentToken.trim()}` },
      });
      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.message ?? "Could not load conversation");
        return;
      }

      setThread(data);
      setTypingUserId(null);
      setStatus("idle");
    } catch {
      setStatus("error");
      setMessage("Could not load conversation");
    }
  }

  function sendSocketEvent(event: { bookingId: string; type: "subscribe" } | {
    bookingId: string;
    isTyping: boolean;
    type: "typing";
  }) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(event));
  }

  function updateConversationList(
    bookingId: string,
    updater: (conversation: Conversation) => Conversation,
  ) {
    setConversations((current) => {
      const existing = current.find((conversation) => conversation.bookingId === bookingId);
      if (!existing) return current;

      const next = current.map((conversation) =>
        conversation.bookingId === bookingId ? updater(conversation) : conversation,
      );

      next.sort((a, b) => {
        const aTime = a.lastMessage?.createdAt
          ? new Date(a.lastMessage.createdAt).getTime()
          : 0;
        const bTime = b.lastMessage?.createdAt
          ? new Date(b.lastMessage.createdAt).getTime()
          : 0;
        return bTime - aTime;
      });

      return next;
    });
  }

  function applyIncomingMessage(bookingId: string, incoming: ThreadMessage) {
    updateConversationList(bookingId, (conversation) => ({
      ...conversation,
      lastMessage: incoming,
      unreadCount:
        selectedBookingIdRef.current === bookingId
          ? 0
          : conversation.unreadCount + 1,
    }));

    if (selectedBookingIdRef.current !== bookingId) {
      return;
    }

    setThread((current) => {
      if (!current || current.booking.id !== bookingId) return current;
      if (current.messages.some((message) => message.id === incoming.id)) {
        return current;
      }

      return {
        ...current,
        messages: [...current.messages, incoming],
      };
    });
  }

  function applyReadReceipt(bookingId: string, messageIds: string[], readAt: string) {
    updateConversationList(bookingId, (conversation) => ({
      ...conversation,
      lastMessage:
        conversation.lastMessage && messageIds.includes(conversation.lastMessage.id)
          ? { ...conversation.lastMessage, readAt }
          : conversation.lastMessage,
    }));

    if (selectedBookingIdRef.current !== bookingId) return;

    setThread((current) => {
      if (!current || current.booking.id !== bookingId) return current;

      return {
        ...current,
        messages: current.messages.map((item) =>
          messageIds.includes(item.id) ? { ...item, readAt } : item,
        ),
      };
    });
  }

  async function markThreadRead(bookingId: string, currentToken: string) {
    if (readingBookingIdsRef.current.has(bookingId)) return;

    readingBookingIdsRef.current.add(bookingId);
    try {
      const response = await fetch(`${API_BASE}/bookings/${bookingId}/messages/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${currentToken.trim()}` },
      });
      const data = await response.json();

      if (response.ok && Array.isArray(data.messageIds) && data.readAt) {
        applyReadReceipt(bookingId, data.messageIds, data.readAt);
        updateConversationList(bookingId, (conversation) => ({
          ...conversation,
          unreadCount: 0,
        }));
      }
    } catch {
      // Ignore transient read receipt failures.
    } finally {
      readingBookingIdsRef.current.delete(bookingId);
    }
  }

  function stopTypingSignal() {
    if (!selectedBookingIdRef.current || !typingSentRef.current) return;

    sendSocketEvent({
      type: "typing",
      bookingId: selectedBookingIdRef.current,
      isTyping: false,
    });
    typingSentRef.current = false;
  }

  function handleDraftChange(value: string) {
    setDraft(value);

    if (!selectedBookingId || !value.trim()) {
      stopTypingSignal();
      return;
    }

    if (!typingSentRef.current) {
      sendSocketEvent({
        type: "typing",
        bookingId: selectedBookingId,
        isTyping: true,
      });
      typingSentRef.current = true;
    }

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      stopTypingSignal();
    }, 1200);
  }

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedBookingId || !draft.trim() || !token.trim()) return;

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/bookings/${selectedBookingId}/messages`,
        {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({ content: draft.trim() }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.message ?? "Could not send message");
        return;
      }

      stopTypingSignal();
      setDraft("");
      applyIncomingMessage(selectedBookingId, data.message);
      updateConversationList(selectedBookingId, (conversation) => ({
        ...conversation,
        lastMessage: data.message,
      }));
      setStatus("idle");
    } catch {
      setStatus("error");
      setMessage("Could not send message");
    }
  }

  if (!enabled) return null;

  return (
    <section className="dashboard-section">
      <div className="dashboard-section-header">
        <h2>Messages</h2>
        {message ? <span className="dashboard-section-note">{message}</span> : null}
      </div>

      <p className="dashboard-meta" style={{ marginBottom: 16 }}>
        {connectionState === "connected"
          ? "Live chat connected"
          : connectionState === "connecting"
            ? "Connecting live chat..."
            : "Live chat offline"}
      </p>

      {conversations.length === 0 ? (
        <div className="empty">No conversations yet. Messages appear once a booking exists.</div>
      ) : (
        <div className="messages-layout">
          <div className="messages-sidebar">
            {conversations.map((conversation) => (
              <button
                key={conversation.bookingId}
                type="button"
                className={
                  conversation.bookingId === selectedBookingId
                    ? "message-conversation active"
                    : "message-conversation"
                }
                onClick={() => setSelectedBookingId(conversation.bookingId)}
              >
                <div className="message-conversation-top">
                  <strong>{conversation.listing.title}</strong>
                  <span className="dashboard-meta">
                    {peerRoleLabel(conversation.participant.role)}
                  </span>
                </div>
                <div className="dashboard-meta">
                  {conversation.participant.name ?? "Unknown participant"}
                </div>
                <div className="message-preview">
                  {conversation.lastMessage?.content ?? "No messages yet"}
                </div>
                {conversation.unreadCount > 0 && (
                  <div className="message-unread-badge">
                    {conversation.unreadCount} unread
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="messages-thread">
            {thread ? (
              <>
                <div className="messages-thread-header">
                  <div>
                    <strong>{thread.booking.listing.title}</strong>
                    <p className="dashboard-meta">
                      With {thread.booking.participant.name ?? "Unknown"} ·{" "}
                      {new Date(thread.booking.checkIn).toLocaleDateString()} to{" "}
                      {new Date(thread.booking.checkOut).toLocaleDateString()}
                    </p>
                    {typingUserId === thread.booking.participant.id && (
                      <p className="message-typing-indicator">
                        {thread.booking.participant.name ?? peerRoleLabel(thread.booking.participant.role)} is typing...
                      </p>
                    )}
                  </div>
                  <span className="badge badge-draft">{thread.booking.status}</span>
                </div>

                <div className="messages-list">
                  {thread.messages.length === 0 ? (
                    <div className="empty">No messages yet. Send the first one.</div>
                  ) : (
                    thread.messages.map((item) => (
                      <div
                        key={item.id}
                        className={
                          item.senderId === thread.booking.participant.id
                            ? "message-bubble incoming"
                            : "message-bubble outgoing"
                        }
                      >
                        <div className="message-author">
                          {item.sender.name ?? "Unknown"}
                        </div>
                        <div>{item.content}</div>
                        <div className="message-time">
                          {new Date(item.createdAt).toLocaleString()}
                          {item.senderId !== thread.booking.participant.id && (
                            <span className="message-read-state">
                              {item.readAt
                                ? ` · Read ${new Date(item.readAt).toLocaleTimeString()}`
                                : " · Sent"}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSend} className="message-form">
                  <textarea
                    rows={3}
                    placeholder="Write a message..."
                    value={draft}
                    onChange={(event) => handleDraftChange(event.target.value)}
                  />
                  <button
                    type="submit"
                    className="book-btn"
                    disabled={!draft.trim() || status === "loading"}
                  >
                    {status === "loading" ? "Sending..." : "Send message"}
                  </button>
                </form>
              </>
            ) : (
              <div className="empty">Select a conversation.</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
