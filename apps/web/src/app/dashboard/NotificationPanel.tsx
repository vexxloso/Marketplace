"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { API_BASE } from "../../lib/api";

type NotificationItem = {
  body: string;
  createdAt: string;
  id: string;
  isRead: boolean;
  link: string | null;
  title: string;
  type: string;
};

export default function NotificationPanel({
  enabled,
  token,
}: {
  enabled: boolean;
  token: string;
}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!enabled || !token.trim()) return;
    void loadNotifications();
  }, [enabled, token]);

  async function loadNotifications() {
    try {
      const response = await fetch(`${API_BASE}/my/notifications`, {
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? "Could not load notifications");
        return;
      }

      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
      setMessage("");
    } catch {
      setMessage("Could not load notifications");
    }
  }

  async function markRead(id: string) {
    try {
      const response = await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? "Could not update notification");
        return;
      }

      setNotifications((current) =>
        current.map((item) =>
          item.id === id ? { ...item, isRead: true } : item,
        ),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
      setMessage("");
    } catch {
      setMessage("Could not update notification");
    }
  }

  async function markAllRead() {
    try {
      const response = await fetch(`${API_BASE}/my/notifications/read-all`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? "Could not update notifications");
        return;
      }

      setNotifications((current) =>
        current.map((item) => ({ ...item, isRead: true })),
      );
      setUnreadCount(0);
      setMessage("");
    } catch {
      setMessage("Could not update notifications");
    }
  }

  if (!enabled) return null;

  return (
    <section className="dashboard-section">
      <div className="dashboard-section-header">
        <h2>Notifications</h2>
        <div className="dashboard-section-tools">
          <span className="dashboard-section-note">{unreadCount} unread</span>
          {notifications.length > 0 ? (
            <button
              type="button"
              className="clear-btn"
              onClick={markAllRead}
            >
              Mark all read
            </button>
          ) : null}
        </div>
      </div>

      {message ? <p className="booking-error">{message}</p> : null}

      {notifications.length === 0 ? (
        <div className="empty">No notifications yet.</div>
      ) : (
        <div className="notifications-list">
          {notifications.map((item) => (
            <div
              key={item.id}
              className={item.isRead ? "notification-card" : "notification-card unread"}
            >
              <div className="notification-top">
                <div>
                  <strong>{item.title}</strong>
                  <p className="dashboard-meta">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                {!item.isRead ? (
                  <button
                    type="button"
                    className="clear-btn"
                    onClick={() => markRead(item.id)}
                  >
                    Mark read
                  </button>
                ) : null}
              </div>
              <p className="dashboard-comment">{item.body}</p>
              {item.link ? <Link href={item.link}>Open</Link> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
