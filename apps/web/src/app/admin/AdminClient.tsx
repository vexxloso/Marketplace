"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { API_BASE } from "../../lib/api";
import { getStoredAdminToken, signOut, storeToken } from "../../lib/auth";

import Reveal from "../Reveal";
import AdminListingEditorModal from "./AdminListingEditorModal";
import AdminListingPhotoPanel from "./AdminListingPhotoPanel";

type AdminUser = {
  createdAt: string;
  email: string;
  id: string;
  isBanned: boolean;
  isSuspended: boolean;
  isVerified: boolean;
  name: string | null;
  role: "user" | "admin";
};

type AdminListing = {
  city: string | null;
  country: string | null;
  createdAt: string;
  host: {
    email: string;
    id: string;
    name: string | null;
  };
  id: string;
  moderationNote: string | null;
  pricePerDay: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  title: string;
  _count: {
    bookings: number;
    reviews: number;
  };
};

type AdminBooking = {
  checkIn: string;
  checkOut: string;
  createdAt: string;
  guest: {
    email: string;
    id: string;
    name: string | null;
  };
  id: string;
  listing: {
    host: {
      email: string;
      id: string;
      name: string | null;
    };
    id: string;
    title: string;
  };
  status: string;
  totalPrice: string;
  payment?: {
    amountTotal: string;
    currency: string;
    id: string;
    status: string;
  } | null;
};

type AdminReview = {
  author: {
    email: string;
    id: string;
    name: string | null;
  };
  comment: string | null;
  createdAt: string;
  id: string;
  listing: {
    id: string;
    title: string;
  };
  moderationNote: string | null;
  moderationStatus: "VISIBLE" | "HIDDEN";
  rating: number;
};

type AdminPayment = {
  amountTotal: string;
  booking: {
    id: string;
    listing: {
      id: string;
      title: string;
    };
  };
  createdAt: string;
  currency: string;
  guest: {
    email: string;
    id: string;
    name: string | null;
  };
  id: string;
  status: string;
  stripeCheckoutSessionId: string | null;
};

type AdminOverview = {
  bookingStatus: {
    cancelled: number;
    confirmed: number;
    pending: number;
  };
  finance: {
    commissionRatePercent: number;
    estimatedCommissionRevenue: number;
    grossBookingRevenue: number;
    paidRevenue: number;
  };
  moderation: {
    archivedListings: number;
    bannedUsers: number;
    hiddenReviews: number;
    suspendedUsers: number;
    verifiedUsers: number;
  };
  paymentStatus: {
    cancelled: number;
    failed: number;
    paid: number;
    pending: number;
  };
  stats: {
    bookings: number;
    listings: number;
    paidPayments: number;
    payments: number;
    publishedListings: number;
    reviews: number;
    users: number;
  };
  trends: Array<{
    bookings: number;
    month: string;
    occupancyRate: number;
    paidRevenue: number;
  }>;
};

type AdminSettings = {
  commissionRatePercent: number;
};

type AdminUserAction =
  | "role-user"
  | "role-admin"
  | "verify"
  | "unverify"
  | "suspend"
  | "unsuspend"
  | "ban"
  | "unban";

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token.trim()}`,
    "Content-Type": "application/json",
  };
}

function statusClass(status: string) {
  if (
    status === "CONFIRMED" ||
    status === "PUBLISHED" ||
    status === "ADMIN" ||
    status === "PAID" ||
    status === "VISIBLE"
  ) {
    return "badge badge-published";
  }
  if (
    status === "PENDING" ||
    status === "DRAFT" ||
    status === "USER" ||
    status === "FAILED"
  ) {
    return "badge badge-draft";
  }
  return "badge badge-archived";
}

function normalizeAdminUser(user: AdminUser): AdminUser {
  if (user.role !== "admin") return user;
  return {
    ...user,
    isBanned: false,
    isSuspended: false,
    isVerified: true,
  };
}

function WindowsLoader({ label }: { label?: string }) {
  return (
    <div className="windows-loader-wrap" aria-live="polite" aria-busy="true">
      <div className="windows-loader" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <span
            key={index}
            className="windows-loader-dot"
            style={{ animationDelay: `${index * 0.12}s` }}
          />
        ))}
      </div>
      {label ? <span className="dashboard-section-note">{label}</span> : null}
    </div>
  );
}

const ADMIN_TAB_QUERY = "tab";

/** Shared page size for all admin data tables (users, listings, bookings, reviews, payments). */
const ADMIN_PAGE_SIZE = 12;

type AdminView =
  | "overview"
  | "users"
  | "listings"
  | "bookings"
  | "reviews"
  | "payments"
  | "settings";

const ADMIN_VIEW_TO_SLUG: Record<Exclude<AdminView, "overview">, string> = {
  users: "users",
  listings: "listings",
  bookings: "bookings",
  reviews: "reviews",
  payments: "payments",
  settings: "settings",
};

const ADMIN_SLUG_TO_VIEW: Record<string, Exclude<AdminView, "overview">> = {
  users: "users",
  listings: "listings",
  bookings: "bookings",
  reviews: "reviews",
  payments: "payments",
  settings: "settings",
};

function IconSettingsGear() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.53-.44 1.65 1.65 0 0 0-1.09 1.09v.08a2 2 0 0 1-1.92 1.92h-.09a2 2 0 0 1-1.92-1.92v-.08c-.04-.43-.4-.8-.83-.98a1.65 1.65 0 0 0-1.53.13l-.07.06a2 2 0 1 1-2.83-2.83l.07-.07c.17-.31.25-.66.22-1.01a1.65 1.65 0 0 0-.5-1.23 1.65 1.65 0 0 0-1.14-.49h-.08a2 2 0 0 1-1.92-1.92v-.09a2 2 0 0 1 1.92-1.92h.08c.43-.02.84-.2 1.14-.49.28-.3.46-.67.5-1.06.03-.35-.05-.7-.22-1.01l-.06-.07a2 2 0 1 1 2.83-2.83l.07.07c.31.17.66.25 1.01.22.39-.04.76-.22 1.06-.5.29-.3.47-.71.49-1.14V4a2 2 0 0 1 1.92-1.92h.09A2 2 0 0 1 12 4v.08c.02.43.2.84.49 1.14.3.28.67.46 1.06.5.35.03.7-.05 1.01-.22l.07-.06a2 2 0 1 1 2.83 2.83l-.06.07a1.65 1.65 0 0 0-.22 1.01c.04.39.22.76.5 1.06.3.29.71.47 1.14.49h.08a2 2 0 0 1 1.92 1.92v.09a2 2 0 0 1-1.92 1.92h-.08c-.43.02-.84.2-1.14.49-.29.3-.47.71-.49 1.14Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function resolveAdminViewFromParams(tabSlug: string | null): AdminView {
  if (!tabSlug || tabSlug.trim() === "") return "overview";
  return ADMIN_SLUG_TO_VIEW[tabSlug] ?? "overview";
}

export default function AdminClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabSlug = searchParams.get(ADMIN_TAB_QUERY);

  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [commissionDraft, setCommissionDraft] = useState("12");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPageLoading, setUsersPageLoading] = useState(false);
  const [openUserMenuId, setOpenUserMenuId] = useState<string | null>(null);
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [listingsPage, setListingsPage] = useState(1);
  const [listingsTotal, setListingsTotal] = useState(0);
  const [listingsPageLoading, setListingsPageLoading] = useState(false);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [bookingsPage, setBookingsPage] = useState(1);
  const [bookingsTotal, setBookingsTotal] = useState(0);
  const [bookingsPageLoading, setBookingsPageLoading] = useState(false);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [reviewsPageLoading, setReviewsPageLoading] = useState(false);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [paymentsPageLoading, setPaymentsPageLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [listingNoteDrafts, setListingNoteDrafts] = useState<Record<string, string>>({});
  const [reviewNoteDrafts, setReviewNoteDrafts] = useState<Record<string, string>>({});
  const [listingEditor, setListingEditor] = useState<
    null | { mode: "create" } | { mode: "edit"; id: string }
  >(null);

  const activeView = useMemo(
    () => resolveAdminViewFromParams(tabSlug),
    [tabSlug],
  );

  useEffect(() => {
    const saved = getStoredAdminToken();
    if (saved) {
      setToken(saved);
      void loadAdmin(saved);
    }
  }, []);

  useEffect(() => {
    if (!tabSlug || tabSlug.trim() === "") return;
    if (!ADMIN_SLUG_TO_VIEW[tabSlug]) {
      router.replace("/admin", { scroll: false });
    }
  }, [tabSlug, router]);

  useEffect(() => {
    if (!openUserMenuId) return;

    function handleDocumentMouseDown(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-admin-user-actions-root]")) {
        return;
      }
      setOpenUserMenuId(null);
    }

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [openUserMenuId]);

  const adminTabs = useMemo(
    () =>
      [
        {
          id: "users" as const,
          label: "Users",
          count: overview?.stats.users ?? usersTotal,
        },
        {
          id: "listings" as const,
          label: "Listings",
          count: overview?.stats.listings ?? listingsTotal,
        },
        {
          id: "bookings" as const,
          label: "Bookings",
          count: overview?.stats.bookings ?? bookingsTotal,
        },
        {
          id: "reviews" as const,
          label: "Reviews",
          count: overview?.stats.reviews ?? reviewsTotal,
        },
        {
          id: "payments" as const,
          label: "Payments",
          count: overview?.stats.payments ?? paymentsTotal,
        },
      ] as const,
    [
      bookingsTotal,
      listingsTotal,
      overview?.stats.bookings,
      overview?.stats.listings,
      overview?.stats.payments,
      overview?.stats.reviews,
      overview?.stats.users,
      paymentsTotal,
      reviewsTotal,
      usersTotal,
    ],
  );

  function navigateAdminView(next: AdminView) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next === "overview") {
      sp.delete(ADMIN_TAB_QUERY);
    } else {
      sp.set(ADMIN_TAB_QUERY, ADMIN_VIEW_TO_SLUG[next]);
    }
    const qs = sp.toString();
    router.replace(qs ? `/admin?${qs}` : "/admin", { scroll: false });
  }

  async function loadAdmin(currentToken: string) {
    setStatus("loading");
    setMessage("");
    setActionMessage("");

    try {
      const responses = await Promise.all([
        fetch(`${API_BASE}/admin/overview`, {
          headers: { Authorization: `Bearer ${currentToken.trim()}` },
        }),
        fetch(`${API_BASE}/admin/settings`, {
          headers: { Authorization: `Bearer ${currentToken.trim()}` },
        }),
        fetch(
          `${API_BASE}/admin/users?page=1&limit=${ADMIN_PAGE_SIZE}`,
          {
            headers: { Authorization: `Bearer ${currentToken.trim()}` },
          },
        ),
        fetch(
          `${API_BASE}/admin/listings?page=1&limit=${ADMIN_PAGE_SIZE}`,
          {
            headers: { Authorization: `Bearer ${currentToken.trim()}` },
          },
        ),
        fetch(
          `${API_BASE}/admin/bookings?page=1&limit=${ADMIN_PAGE_SIZE}`,
          {
            headers: { Authorization: `Bearer ${currentToken.trim()}` },
          },
        ),
        fetch(
          `${API_BASE}/admin/reviews?page=1&limit=${ADMIN_PAGE_SIZE}`,
          {
            headers: { Authorization: `Bearer ${currentToken.trim()}` },
          },
        ),
        fetch(
          `${API_BASE}/admin/payments?page=1&limit=${ADMIN_PAGE_SIZE}`,
          {
            headers: { Authorization: `Bearer ${currentToken.trim()}` },
          },
        ),
      ]);

      const payloads = await Promise.all(responses.map((response) => response.json()));

      if (responses.some((response) => !response.ok)) {
        const firstError = payloads.find((payload) => payload?.message);
        setStatus("error");
        setMessage(firstError?.message ?? "Could not load admin panel");
        return;
      }

      const nextOverview = payloads[0].overview ?? null;
      const nextSettings = payloads[1].settings ?? null;
      const userPayload = payloads[2];
      const nextUsers = userPayload.users ?? [];
      const userPagination = userPayload.pagination as
        | { page: number; total: number; totalPages: number }
        | undefined;
      const listingsPayload = payloads[3];
      const nextListings = listingsPayload.listings ?? [];
      const listingsPagination = listingsPayload.pagination as
        | { page: number; total: number }
        | undefined;

      const bookingsPayload = payloads[4];
      const nextBookings = bookingsPayload.bookings ?? [];
      const bookingsPagination = bookingsPayload.pagination as
        | { page: number; total: number }
        | undefined;

      const reviewsPayload = payloads[5];
      const nextReviews = reviewsPayload.reviews ?? [];
      const reviewsPagination = reviewsPayload.pagination as
        | { page: number; total: number }
        | undefined;

      const paymentsPayload = payloads[6];
      const nextPayments = paymentsPayload.payments ?? [];
      const paymentsPagination = paymentsPayload.pagination as
        | { page: number; total: number }
        | undefined;

      setOverview(nextOverview);
      setSettings(nextSettings);
      setCommissionDraft(String(nextSettings?.commissionRatePercent ?? 12));
      setUsers(nextUsers);
      if (userPagination) {
        setUsersPage(userPagination.page);
        setUsersTotal(userPagination.total);
      } else {
        setUsersPage(1);
        setUsersTotal(nextUsers.length);
      }
      setListings(nextListings);
      if (listingsPagination) {
        setListingsPage(listingsPagination.page);
        setListingsTotal(listingsPagination.total);
      } else {
        setListingsPage(1);
        setListingsTotal(nextListings.length);
      }
      setBookings(nextBookings);
      if (bookingsPagination) {
        setBookingsPage(bookingsPagination.page);
        setBookingsTotal(bookingsPagination.total);
      } else {
        setBookingsPage(1);
        setBookingsTotal(nextBookings.length);
      }
      setReviews(nextReviews);
      if (reviewsPagination) {
        setReviewsPage(reviewsPagination.page);
        setReviewsTotal(reviewsPagination.total);
      } else {
        setReviewsPage(1);
        setReviewsTotal(nextReviews.length);
      }
      setPayments(nextPayments);
      if (paymentsPagination) {
        setPaymentsPage(paymentsPagination.page);
        setPaymentsTotal(paymentsPagination.total);
      } else {
        setPaymentsPage(1);
        setPaymentsTotal(nextPayments.length);
      }
      setListingNoteDrafts(
        Object.fromEntries(
          nextListings.map((listing: AdminListing) => [
            listing.id,
            listing.moderationNote ?? "",
          ]),
        ),
      );
      setReviewNoteDrafts(
        Object.fromEntries(
          nextReviews.map((review: AdminReview) => [review.id, review.moderationNote ?? ""]),
        ),
      );
      storeToken(currentToken, "admin");
      setStatus("ready");
    } catch {
      setStatus("error");
      setMessage("Could not load admin panel");
    }
  }

  async function reloadListings(page?: number) {
    if (!token.trim()) return;
    const p = page ?? listingsPage;
    try {
      const response = await fetch(
        `${API_BASE}/admin/listings?page=${p}&limit=${ADMIN_PAGE_SIZE}`,
        {
          headers: { Authorization: `Bearer ${token.trim()}` },
        },
      );
      const data = await response.json();
      if (!response.ok) return;
      const nextListings = data.listings ?? [];
      setListings(nextListings);
      const pag = data.pagination as { page: number; total: number } | undefined;
      if (pag) {
        setListingsPage(pag.page);
        setListingsTotal(pag.total);
      }
      setListingNoteDrafts(
        Object.fromEntries(
          nextListings.map((listing: AdminListing) => [listing.id, listing.moderationNote ?? ""]),
        ),
      );
    } catch {
      /* ignore */
    }
  }

  async function loadUsersPage(page: number) {
    if (!token.trim()) return;
    setUsersPageLoading(true);
    setActionMessage("");
    try {
      const response = await fetch(
        `${API_BASE}/admin/users?page=${page}&limit=${ADMIN_PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${token.trim()}` } },
      );
      const data = await response.json();
      if (!response.ok) {
        setActionMessage(data.message ?? "Could not load users");
        return;
      }
      setUsers(data.users ?? []);
      const p = data.pagination as { page: number; total: number } | undefined;
      if (p) {
        setUsersPage(p.page);
        setUsersTotal(p.total);
      }
    } catch {
      setActionMessage("Could not load users");
    } finally {
      setUsersPageLoading(false);
    }
  }

  async function loadListingsPage(page: number) {
    if (!token.trim()) return;
    setListingsPageLoading(true);
    setActionMessage("");
    try {
      const response = await fetch(
        `${API_BASE}/admin/listings?page=${page}&limit=${ADMIN_PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${token.trim()}` } },
      );
      const data = await response.json();
      if (!response.ok) {
        setActionMessage(data.message ?? "Could not load listings");
        return;
      }
      const rows = data.listings ?? [];
      setListings(rows);
      const p = data.pagination as { page: number; total: number } | undefined;
      if (p) {
        setListingsPage(p.page);
        setListingsTotal(p.total);
      }
      setListingNoteDrafts(
        Object.fromEntries(rows.map((listing: AdminListing) => [listing.id, listing.moderationNote ?? ""])),
      );
    } catch {
      setActionMessage("Could not load listings");
    } finally {
      setListingsPageLoading(false);
    }
  }

  async function loadBookingsPage(page: number) {
    if (!token.trim()) return;
    setBookingsPageLoading(true);
    setActionMessage("");
    try {
      const response = await fetch(
        `${API_BASE}/admin/bookings?page=${page}&limit=${ADMIN_PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${token.trim()}` } },
      );
      const data = await response.json();
      if (!response.ok) {
        setActionMessage(data.message ?? "Could not load bookings");
        return;
      }
      setBookings(data.bookings ?? []);
      const p = data.pagination as { page: number; total: number } | undefined;
      if (p) {
        setBookingsPage(p.page);
        setBookingsTotal(p.total);
      }
    } catch {
      setActionMessage("Could not load bookings");
    } finally {
      setBookingsPageLoading(false);
    }
  }

  async function loadReviewsPage(page: number) {
    if (!token.trim()) return;
    setReviewsPageLoading(true);
    setActionMessage("");
    try {
      const response = await fetch(
        `${API_BASE}/admin/reviews?page=${page}&limit=${ADMIN_PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${token.trim()}` } },
      );
      const data = await response.json();
      if (!response.ok) {
        setActionMessage(data.message ?? "Could not load reviews");
        return;
      }
      const rows = data.reviews ?? [];
      setReviews(rows);
      const p = data.pagination as { page: number; total: number } | undefined;
      if (p) {
        setReviewsPage(p.page);
        setReviewsTotal(p.total);
      }
      setReviewNoteDrafts(
        Object.fromEntries(rows.map((review: AdminReview) => [review.id, review.moderationNote ?? ""])),
      );
    } catch {
      setActionMessage("Could not load reviews");
    } finally {
      setReviewsPageLoading(false);
    }
  }

  async function loadPaymentsPage(page: number) {
    if (!token.trim()) return;
    setPaymentsPageLoading(true);
    setActionMessage("");
    try {
      const response = await fetch(
        `${API_BASE}/admin/payments?page=${page}&limit=${ADMIN_PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${token.trim()}` } },
      );
      const data = await response.json();
      if (!response.ok) {
        setActionMessage(data.message ?? "Could not load payments");
        return;
      }
      setPayments(data.payments ?? []);
      const p = data.pagination as { page: number; total: number } | undefined;
      if (p) {
        setPaymentsPage(p.page);
        setPaymentsTotal(p.total);
      }
    } catch {
      setActionMessage("Could not load payments");
    } finally {
      setPaymentsPageLoading(false);
    }
  }

  async function updateUserRole(userId: string, role: AdminUser["role"]) {
    setActionMessage("Updating user role...");

    try {
      const response = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ role }),
      });
      const data = await response.json();

      if (!response.ok) {
        setActionMessage(data.message ?? "Could not update role");
        return;
      }

      setUsers((current) =>
        current.map((user) => (user.id === userId ? { ...user, role } : user)),
      );
      setActionMessage("User role updated");
    } catch {
      setActionMessage("Could not update role");
    }
  }

  async function updateUserModeration(
    userId: string,
    patch: Partial<Pick<AdminUser, "isVerified" | "isSuspended" | "isBanned">>,
  ) {
    setActionMessage("Updating user moderation...");

    try {
      const response = await fetch(`${API_BASE}/admin/users/${userId}/moderation`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify(patch),
      });

      const raw = await response.text();
      let data: { message?: string; user?: AdminUser } = {};
      if (raw) {
        try {
          data = JSON.parse(raw) as typeof data;
        } catch {
          setActionMessage(raw.slice(0, 160) || `Error ${response.status}`);
          return;
        }
      }

      if (!response.ok) {
        setActionMessage(data.message ?? `Could not update user moderation (${response.status})`);
        return;
      }

      if (!data.user) {
        setActionMessage("Server did not return updated user");
        return;
      }

      setUsers((current) =>
        current.map((user) => (user.id === userId ? data.user! : user)),
      );
      setActionMessage("User moderation updated");
    } catch {
      setActionMessage("Could not update user moderation");
    }
  }

  function applyUserAdminAction(user: AdminUser, value: AdminUserAction) {
    setOpenUserMenuId(null);

    switch (value) {
      case "role-user":
        if (user.role !== "user") void updateUserRole(user.id, "user");
        break;
      case "role-admin":
        if (user.role !== "admin") void updateUserRole(user.id, "admin");
        break;
      case "verify":
        if (!user.isVerified) void updateUserModeration(user.id, { isVerified: true });
        break;
      case "unverify":
        if (user.role !== "admin" && user.isVerified) {
          void updateUserModeration(user.id, { isVerified: false });
        }
        break;
      case "suspend":
        if (user.role !== "admin" && !user.isSuspended) {
          void updateUserModeration(user.id, { isSuspended: true });
        }
        break;
      case "unsuspend":
        if (user.role !== "admin" && user.isSuspended) {
          void updateUserModeration(user.id, { isSuspended: false });
        }
        break;
      case "ban":
        if (user.role !== "admin" && !user.isBanned) {
          void updateUserModeration(user.id, { isBanned: true });
        }
        break;
      case "unban":
        if (user.role !== "admin" && user.isBanned) {
          void updateUserModeration(user.id, { isBanned: false });
        }
        break;
      default:
        break;
    }
  }

  async function updateListingStatus(
    listingId: string,
    statusValue: AdminListing["status"],
  ) {
    setActionMessage("Updating listing status...");

    try {
      const response = await fetch(`${API_BASE}/admin/listings/${listingId}/status`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({
          status: statusValue,
          moderationNote: listingNoteDrafts[listingId] || null,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setActionMessage(data.message ?? "Could not update listing");
        return;
      }

      setListings((current) =>
        current.map((listing) =>
          listing.id === listingId
            ? {
                ...listing,
                moderationNote: data.listing?.moderationNote ?? listing.moderationNote,
                status: statusValue,
              }
            : listing,
        ),
      );
      setActionMessage("Listing status updated");
    } catch {
      setActionMessage("Could not update listing");
    }
  }

  async function updateReviewModeration(
    reviewId: string,
    moderationStatus: AdminReview["moderationStatus"],
  ) {
    setActionMessage("Updating review moderation...");

    try {
      const response = await fetch(`${API_BASE}/admin/reviews/${reviewId}/moderation`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({
          moderationNote: reviewNoteDrafts[reviewId] || null,
          moderationStatus,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setActionMessage(data.message ?? "Could not update review moderation");
        return;
      }

      setReviews((current) =>
        current.map((review) =>
          review.id === reviewId
            ? {
                ...review,
                moderationNote: data.review?.moderationNote ?? review.moderationNote,
                moderationStatus,
              }
            : review,
        ),
      );
      setActionMessage("Review moderation updated");
    } catch {
      setActionMessage("Could not update review moderation");
    }
  }

  async function updateCommissionRate() {
    setActionMessage("Updating commission rate...");

    try {
      const response = await fetch(`${API_BASE}/admin/settings`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({
          commissionRatePercent: Number(commissionDraft),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setActionMessage(data.message ?? "Could not update commission rate");
        return;
      }

      setSettings(data.settings);
      setOverview((current) =>
        current
          ? {
              ...current,
              finance: {
                ...current.finance,
                commissionRatePercent: data.settings.commissionRatePercent,
                estimatedCommissionRevenue: Number(
                  (
                    (current.finance.paidRevenue * data.settings.commissionRatePercent) /
                    100
                  ).toFixed(2),
                ),
              },
            }
          : current,
      );
      setActionMessage("Commission rate updated");
    } catch {
      setActionMessage("Could not update commission rate");
    }
  }

  function handleSignOut() {
    signOut();
    setToken("");
    setStatus("idle");
    setMessage("");
    setOverview(null);
    setSettings(null);
    setUsers([]);
    setUsersPage(1);
    setUsersTotal(0);
    setUsersPageLoading(false);
    setListings([]);
    setBookings([]);
    setReviews([]);
    setPayments([]);
    setActionMessage("");
    setListingNoteDrafts({});
    setReviewNoteDrafts({});
    router.push("/");
    router.refresh();
  }

  function renderOverview() {
    if (!overview) return null;

    return (
      <>
        <Reveal>
          <section className="dashboard-section admin-overview-reveal-scope">
            <div className="dashboard-section-header">
              <h2>Snapshot</h2>
              <button
                type="button"
                className="clear-btn"
                onClick={() => void loadAdmin(token)}
                disabled={status === "loading"}
              >
                {status === "loading" ? "Refreshing…" : "Refresh data"}
              </button>
            </div>
            <div className="admin-overview-table-wrap">
              <table className="admin-overview-table">
                <thead>
                  <tr>
                    <th scope="col">Metric</th>
                    <th scope="col">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Users</td>
                    <td className="admin-overview-table-num">{overview.stats.users}</td>
                  </tr>
                  <tr>
                    <td>Listings</td>
                    <td className="admin-overview-table-num">{overview.stats.listings}</td>
                  </tr>
                  <tr>
                    <td>Bookings</td>
                    <td className="admin-overview-table-num">{overview.stats.bookings}</td>
                  </tr>
                  <tr>
                    <td>Reviews</td>
                    <td className="admin-overview-table-num">{overview.stats.reviews}</td>
                  </tr>
                  <tr>
                    <td>Payments</td>
                    <td className="admin-overview-table-num">{overview.stats.payments}</td>
                  </tr>
                  <tr>
                    <td>Commission rate</td>
                    <td className="admin-overview-table-num">
                      {settings?.commissionRatePercent ?? overview.finance.commissionRatePercent}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="dashboard-section admin-overview-reveal-scope">
            <div className="dashboard-section-header">
              <h2>Platform analytics</h2>
              {actionMessage ? <span className="dashboard-section-note">{actionMessage}</span> : null}
            </div>
            <div className="admin-overview-layout">
              <div className="admin-overview-block">
                <div className="admin-overview-block-head">
                  <strong>Revenue</strong>
                  <span className="admin-overview-tag">Finance</span>
                </div>
                <div className="admin-overview-table-wrap">
                  <table className="admin-overview-table">
                    <thead>
                      <tr>
                        <th scope="col">Line</th>
                        <th scope="col">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Gross bookings</td>
                        <td className="admin-overview-table-num admin-overview-table--accent">
                          ${overview.finance.grossBookingRevenue.toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td>Paid revenue</td>
                        <td className="admin-overview-table-num">
                          ${overview.finance.paidRevenue.toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td>Estimated commission</td>
                        <td className="admin-overview-table-num">
                          ${overview.finance.estimatedCommissionRevenue.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="admin-overview-block">
                <div className="admin-overview-block-head">
                  <strong>Moderation snapshot</strong>
                  <span className="admin-overview-tag">Trust</span>
                </div>
                <div className="admin-overview-table-wrap">
                  <table className="admin-overview-table">
                    <thead>
                      <tr>
                        <th scope="col">Signal</th>
                        <th scope="col">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Verified users</td>
                        <td className="admin-overview-table-num">{overview.moderation.verifiedUsers}</td>
                      </tr>
                      <tr>
                        <td>Suspended users</td>
                        <td className="admin-overview-table-num">{overview.moderation.suspendedUsers}</td>
                      </tr>
                      <tr>
                        <td>Banned users</td>
                        <td className="admin-overview-table-num">{overview.moderation.bannedUsers}</td>
                      </tr>
                      <tr>
                        <td>Hidden reviews</td>
                        <td className="admin-overview-table-num">{overview.moderation.hiddenReviews}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="admin-overview-block">
                <div className="admin-overview-block-head">
                  <strong>Booking mix</strong>
                  <span className="admin-overview-tag">Operations</span>
                </div>
                <div className="admin-overview-table-wrap">
                  <table className="admin-overview-table">
                    <thead>
                      <tr>
                        <th scope="col">Status</th>
                        <th scope="col">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Pending</td>
                        <td className="admin-overview-table-num">{overview.bookingStatus.pending}</td>
                      </tr>
                      <tr>
                        <td>Confirmed</td>
                        <td className="admin-overview-table-num">{overview.bookingStatus.confirmed}</td>
                      </tr>
                      <tr>
                        <td>Cancelled</td>
                        <td className="admin-overview-table-num">{overview.bookingStatus.cancelled}</td>
                      </tr>
                      <tr>
                        <td>Paid payments</td>
                        <td className="admin-overview-table-num">{overview.paymentStatus.paid}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="admin-overview-block">
                <div className="admin-overview-block-head">
                  <strong>Commission rate</strong>
                  <span className="admin-overview-tag">Settings</span>
                </div>
                <div className="admin-overview-table-wrap">
                  <table className="admin-overview-table">
                    <tbody>
                      <tr>
                        <td>Current</td>
                        <td className="admin-overview-table-num">
                          {settings?.commissionRatePercent ?? overview.finance.commissionRatePercent}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="admin-action-row admin-action-row--tight">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={commissionDraft}
                    onChange={(event) => setCommissionDraft(event.target.value)}
                    className="filter-input"
                  />
                  <button type="button" className="clear-btn" onClick={updateCommissionRate}>
                    Save commission
                  </button>
                </div>
              </div>

              <div className="admin-overview-block admin-overview-block--flush">
                <div className="admin-overview-block-head">
                  <strong>Occupancy trend</strong>
                  <span className="admin-overview-tag">Last 6 months</span>
                </div>
                <div className="admin-overview-table-wrap">
                  <table className="admin-overview-table admin-overview-table--trend">
                    <thead>
                      <tr>
                        <th scope="col">Month</th>
                        <th scope="col">Bookings</th>
                        <th scope="col">Occupancy</th>
                        <th scope="col">Paid revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.trends.map((trend) => (
                        <tr key={trend.month}>
                          <td>{trend.month}</td>
                          <td className="admin-overview-table-num">{trend.bookings}</td>
                          <td className="admin-overview-table-num">{trend.occupancyRate}%</td>
                          <td className="admin-overview-table-num">${trend.paidRevenue.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        </Reveal>
      </>
    );
  }

  function renderUsers() {
    const usersTotalPages = Math.max(1, Math.ceil(usersTotal / ADMIN_PAGE_SIZE));

    return (
      <section className="dashboard-section">
        {actionMessage ? (
          <div className="dashboard-section-header">
            <span className="dashboard-section-note">{actionMessage}</span>
          </div>
        ) : null}
        <div className="admin-table-full-bleed">
          <div className="admin-table-scroll admin-table-scroll--wide">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th scope="col">No.</th>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Account</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="admin-data-table-empty">
                      {usersPageLoading ? "Loading users…" : "No users loaded."}
                    </td>
                  </tr>
                ) : (
                  users.map((rawUser, index) => {
                    const user = normalizeAdminUser(rawUser);

                    return (
                    <tr key={user.id}>
                      <td className="admin-data-table-meta admin-data-table-nowrap">
                        {(usersPage - 1) * ADMIN_PAGE_SIZE + index + 1}
                      </td>
                      <td>{user.name ?? "Unnamed user"}</td>
                      <td className="admin-data-table-nowrap">{user.email}</td>
                      <td>
                        <span className={statusClass(user.role.toUpperCase())}>{user.role}</span>
                      </td>
                      <td className="admin-data-table-meta">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="admin-user-account-tags">
                          <span
                            className={`admin-account-tag ${
                              user.isVerified ? "admin-account-tag--verified" : "admin-account-tag--unverified"
                            }`}
                          >
                            {user.isVerified ? "Verified" : "Unverified"}
                          </span>
                          <span
                            className={`admin-account-tag ${
                              user.isSuspended ? "admin-account-tag--suspended" : "admin-account-tag--active"
                            }`}
                          >
                            {user.isSuspended ? "Suspended" : "Active"}
                          </span>
                          <span
                            className={`admin-account-tag ${
                              user.isBanned ? "admin-account-tag--banned" : "admin-account-tag--clear"
                            }`}
                          >
                            {user.isBanned ? "Banned" : "Clear"}
                          </span>
                        </div>
                      </td>
                      <td className="admin-table-cell-actions">
                        <div className="admin-user-actions-menu" data-admin-user-actions-root>
                          <button
                            type="button"
                            className="admin-user-actions-trigger"
                            aria-expanded={openUserMenuId === user.id}
                            onClick={() =>
                              setOpenUserMenuId((current) => (current === user.id ? null : user.id))
                            }
                          >
                            <span>Choose action...</span>
                            <span className="admin-user-actions-trigger-caret" aria-hidden>
                              v
                            </span>
                          </button>

                          {openUserMenuId === user.id ? (
                            <div className="admin-user-actions-panel">
                              <div className="admin-user-actions-group">
                                <span className="admin-user-actions-label">Role</span>
                                {user.role === "admin" ? (
                                  <button
                                    type="button"
                                    className="admin-user-actions-item"
                                    onClick={() => applyUserAdminAction(user, "role-user")}
                                  >
                                    Make user
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="admin-user-actions-item"
                                    onClick={() => applyUserAdminAction(user, "role-admin")}
                                  >
                                    Make admin
                                  </button>
                                )}
                              </div>

                              {user.role !== "admin" ? (
                                <div className="admin-user-actions-group">
                                  <span className="admin-user-actions-label">Account status</span>
                                  {!user.isVerified ? (
                                    <button
                                      type="button"
                                      className="admin-user-actions-item"
                                      onClick={() => applyUserAdminAction(user, "verify")}
                                    >
                                      Verify
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="admin-user-actions-item"
                                      onClick={() => applyUserAdminAction(user, "unverify")}
                                    >
                                      Unverify
                                    </button>
                                  )}

                                  {!user.isSuspended ? (
                                    <button
                                      type="button"
                                      className="admin-user-actions-item"
                                      onClick={() => applyUserAdminAction(user, "suspend")}
                                    >
                                      Suspend
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="admin-user-actions-item"
                                      onClick={() => applyUserAdminAction(user, "unsuspend")}
                                    >
                                      Unsuspend
                                    </button>
                                  )}

                                  {!user.isBanned ? (
                                    <button
                                      type="button"
                                      className="admin-user-actions-item"
                                      onClick={() => applyUserAdminAction(user, "ban")}
                                    >
                                      Ban
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="admin-user-actions-item"
                                      onClick={() => applyUserAdminAction(user, "unban")}
                                    >
                                      Unban
                                    </button>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )})
                )}
              </tbody>
            </table>
          </div>
          <nav className="admin-table-pagination" aria-label="Users pagination">
            <button
              type="button"
              className="clear-btn"
              disabled={usersPage <= 1 || usersPageLoading}
              onClick={() => void loadUsersPage(usersPage - 1)}
            >
              Previous
            </button>
            <span className="admin-table-pagination-meta">
              Page {usersPage} of {usersTotalPages}
              {usersTotal > 0 ? ` · ${usersTotal} users` : null}
            </span>
            <button
              type="button"
              className="clear-btn"
              disabled={usersPage >= usersTotalPages || usersPageLoading}
              onClick={() => void loadUsersPage(usersPage + 1)}
            >
              Next
            </button>
          </nav>
        </div>
      </section>
    );
  }

  function renderListings() {
    const listingsTotalPages = Math.max(1, Math.ceil(listingsTotal / ADMIN_PAGE_SIZE));

    return (
      <section className="dashboard-section">
        {actionMessage ? (
          <div className="dashboard-section-header">
            <span className="dashboard-section-note">{actionMessage}</span>
          </div>
        ) : null}
        <div className="admin-listings-toolbar">
          <button type="button" className="hero-primary" onClick={() => setListingEditor({ mode: "create" })}>
            New listing
          </button>
        </div>
        <div className="admin-table-full-bleed">
          <div className="admin-table-scroll admin-table-scroll--wide">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th scope="col">No.</th>
                  <th scope="col">Listing</th>
                  <th scope="col">Status</th>
                  <th scope="col">Location</th>
                  <th scope="col">Activity</th>
                  <th scope="col">Price</th>
                  <th scope="col">Note</th>
                  <th scope="col">Photos</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {listings.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="admin-data-table-empty">
                      {listingsPageLoading ? "Loading listings…" : "No listings on this page."}
                    </td>
                  </tr>
                ) : (
                  listings.map((listing, index) => (
                    <tr key={listing.id}>
                      <td className="admin-data-table-meta admin-data-table-nowrap">
                        {(listingsPage - 1) * ADMIN_PAGE_SIZE + index + 1}
                      </td>
                      <td>
                        <Link href={`/listings/${listing.id}`}>{listing.title}</Link>
                      </td>
                      <td>
                        <span className={statusClass(listing.status)}>{listing.status}</span>
                      </td>
                      <td className="admin-data-table-meta">
                        {listing.city || listing.country
                          ? [listing.city, listing.country].filter(Boolean).join(", ")
                          : "—"}
                      </td>
                      <td className="admin-data-table-meta">
                        {listing._count.bookings} bookings · {listing._count.reviews} reviews
                      </td>
                      <td className="admin-data-table-nowrap">${listing.pricePerDay}/night</td>
                      <td className="admin-table-cell-note">
                        <textarea
                          className="admin-note-input"
                          rows={2}
                          placeholder="Moderation note"
                          value={listingNoteDrafts[listing.id] ?? ""}
                          onChange={(event) =>
                            setListingNoteDrafts((current) => ({
                              ...current,
                              [listing.id]: event.target.value,
                            }))
                          }
                        />
                      </td>
                      <td className="admin-table-cell-photos">
                        <AdminListingPhotoPanel listingId={listing.id} token={token} />
                      </td>
                      <td className="admin-table-cell-actions">
                        <div className="admin-action-row">
                          <button
                            type="button"
                            className="clear-btn"
                            onClick={() => setListingEditor({ mode: "edit", id: listing.id })}
                          >
                            Edit
                          </button>
                          <button type="button" className="clear-btn" onClick={() => updateListingStatus(listing.id, "DRAFT")}>
                            Draft
                          </button>
                          <button
                            type="button"
                            className="clear-btn"
                            onClick={() => updateListingStatus(listing.id, "PUBLISHED")}
                          >
                            Publish
                          </button>
                          <button type="button" className="clear-btn" onClick={() => updateListingStatus(listing.id, "ARCHIVED")}>
                            Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <nav className="admin-table-pagination" aria-label="Listings pagination">
            <button
              type="button"
              className="clear-btn"
              disabled={listingsPage <= 1 || listingsPageLoading}
              onClick={() => void loadListingsPage(listingsPage - 1)}
            >
              Previous
            </button>
            <span className="admin-table-pagination-meta">
              Page {listingsPage} of {listingsTotalPages}
              {listingsTotal > 0 ? ` · ${listingsTotal} listings` : null}
            </span>
            <button
              type="button"
              className="clear-btn"
              disabled={listingsPage >= listingsTotalPages || listingsPageLoading}
              onClick={() => void loadListingsPage(listingsPage + 1)}
            >
              Next
            </button>
          </nav>
        </div>
      </section>
    );
  }

  function renderBookings() {
    const bookingsTotalPages = Math.max(1, Math.ceil(bookingsTotal / ADMIN_PAGE_SIZE));

    return (
      <section className="dashboard-section">
        <div className="admin-table-full-bleed">
          <div className="admin-table-scroll admin-table-scroll--wide">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th scope="col">No.</th>
                  <th scope="col">Listing</th>
                  <th scope="col">Status</th>
                  <th scope="col">Guest</th>
                  <th scope="col">Host</th>
                  <th scope="col">Stay</th>
                  <th scope="col">Total</th>
                  <th scope="col">Payment</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="admin-data-table-empty">
                      {bookingsPageLoading ? "Loading bookings…" : "No bookings on this page."}
                    </td>
                  </tr>
                ) : (
                  bookings.map((booking, index) => (
                    <tr key={booking.id}>
                      <td className="admin-data-table-meta admin-data-table-nowrap">
                        {(bookingsPage - 1) * ADMIN_PAGE_SIZE + index + 1}
                      </td>
                      <td>
                        <Link href={`/listings/${booking.listing.id}`}>{booking.listing.title}</Link>
                      </td>
                      <td>
                        <span className={statusClass(booking.status)}>{booking.status}</span>
                      </td>
                      <td className="admin-data-table-meta">{booking.guest.name ?? booking.guest.email}</td>
                      <td className="admin-data-table-meta">{booking.listing.host.name ?? booking.listing.host.email}</td>
                      <td className="admin-data-table-meta admin-data-table-nowrap">
                        {new Date(booking.checkIn).toLocaleDateString()} – {new Date(booking.checkOut).toLocaleDateString()}
                      </td>
                      <td className="admin-data-table-nowrap">${booking.totalPrice}</td>
                      <td className="admin-data-table-meta">
                        {booking.payment?.status ?? "NONE"}
                        {booking.payment
                          ? ` · ${booking.payment.currency.toUpperCase()} ${booking.payment.amountTotal}`
                          : ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <nav className="admin-table-pagination" aria-label="Bookings pagination">
            <button
              type="button"
              className="clear-btn"
              disabled={bookingsPage <= 1 || bookingsPageLoading}
              onClick={() => void loadBookingsPage(bookingsPage - 1)}
            >
              Previous
            </button>
            <span className="admin-table-pagination-meta">
              Page {bookingsPage} of {bookingsTotalPages}
              {bookingsTotal > 0 ? ` · ${bookingsTotal} bookings` : null}
            </span>
            <button
              type="button"
              className="clear-btn"
              disabled={bookingsPage >= bookingsTotalPages || bookingsPageLoading}
              onClick={() => void loadBookingsPage(bookingsPage + 1)}
            >
              Next
            </button>
          </nav>
        </div>
      </section>
    );
  }

  function renderReviews() {
    const reviewsTotalPages = Math.max(1, Math.ceil(reviewsTotal / ADMIN_PAGE_SIZE));

    return (
      <section className="dashboard-section">
        {actionMessage ? (
          <div className="dashboard-section-header">
            <span className="dashboard-section-note">{actionMessage}</span>
          </div>
        ) : null}
        <div className="admin-table-full-bleed">
          <div className="admin-table-scroll admin-table-scroll--wide">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th scope="col">No.</th>
                  <th scope="col">Listing</th>
                  <th scope="col">Author</th>
                  <th scope="col">Rating</th>
                  <th scope="col">Status</th>
                  <th scope="col">Comment</th>
                  <th scope="col">Note</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {reviews.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="admin-data-table-empty">
                      {reviewsPageLoading ? "Loading reviews…" : "No reviews on this page."}
                    </td>
                  </tr>
                ) : (
                  reviews.map((review, index) => (
                    <tr key={review.id}>
                      <td className="admin-data-table-meta admin-data-table-nowrap">
                        {(reviewsPage - 1) * ADMIN_PAGE_SIZE + index + 1}
                      </td>
                      <td>
                        <Link href={`/listings/${review.listing.id}`}>{review.listing.title}</Link>
                      </td>
                      <td className="admin-data-table-meta">
                        {review.author.name ?? review.author.email}
                      </td>
                      <td className="admin-data-table-meta">★ {review.rating}</td>
                      <td>
                        <span className={statusClass(review.moderationStatus)}>{review.moderationStatus}</span>
                      </td>
                      <td className="admin-review-comment-cell admin-data-table-meta">
                        {review.comment ?? "—"}
                      </td>
                      <td className="admin-table-cell-note">
                        <textarea
                          className="admin-note-input"
                          rows={2}
                          placeholder="Moderation note"
                          value={reviewNoteDrafts[review.id] ?? ""}
                          onChange={(event) =>
                            setReviewNoteDrafts((current) => ({
                              ...current,
                              [review.id]: event.target.value,
                            }))
                          }
                        />
                      </td>
                      <td className="admin-table-cell-actions">
                        <select
                          className="filter-input admin-table-action-select"
                          aria-label={`Moderation action for review ${review.id}`}
                          value={review.moderationStatus}
                          onChange={(event) => {
                            const next = event.target.value as AdminReview["moderationStatus"];
                            if (next !== review.moderationStatus) {
                              void updateReviewModeration(review.id, next);
                            }
                          }}
                        >
                          <option value="VISIBLE">Visible</option>
                          <option value="HIDDEN">Hidden</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <nav className="admin-table-pagination" aria-label="Reviews pagination">
            <button
              type="button"
              className="clear-btn"
              disabled={reviewsPage <= 1 || reviewsPageLoading}
              onClick={() => void loadReviewsPage(reviewsPage - 1)}
            >
              Previous
            </button>
            <span className="admin-table-pagination-meta">
              Page {reviewsPage} of {reviewsTotalPages}
              {reviewsTotal > 0 ? ` · ${reviewsTotal} reviews` : null}
            </span>
            <button
              type="button"
              className="clear-btn"
              disabled={reviewsPage >= reviewsTotalPages || reviewsPageLoading}
              onClick={() => void loadReviewsPage(reviewsPage + 1)}
            >
              Next
            </button>
          </nav>
        </div>
      </section>
    );
  }

  function renderPayments() {
    const paymentsTotalPages = Math.max(1, Math.ceil(paymentsTotal / ADMIN_PAGE_SIZE));

    return (
      <section className="dashboard-section">
        <div className="admin-table-full-bleed">
          <div className="admin-table-scroll admin-table-scroll--wide">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th scope="col">No.</th>
                  <th scope="col">Listing</th>
                  <th scope="col">Status</th>
                  <th scope="col">Guest</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Booking</th>
                  <th scope="col">Session</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="admin-data-table-empty">
                      {paymentsPageLoading ? "Loading payments…" : "No payments on this page."}
                    </td>
                  </tr>
                ) : (
                  payments.map((payment, index) => (
                    <tr key={payment.id}>
                      <td className="admin-data-table-meta admin-data-table-nowrap">
                        {(paymentsPage - 1) * ADMIN_PAGE_SIZE + index + 1}
                      </td>
                      <td>
                        <Link href={`/listings/${payment.booking.listing.id}`}>{payment.booking.listing.title}</Link>
                      </td>
                      <td>
                        <span className={statusClass(payment.status)}>{payment.status}</span>
                      </td>
                      <td className="admin-data-table-meta">{payment.guest.name ?? payment.guest.email}</td>
                      <td className="admin-data-table-nowrap">
                        {payment.currency.toUpperCase()} {payment.amountTotal}
                      </td>
                      <td className="admin-data-table-meta admin-data-table-nowrap">{payment.booking.id}</td>
                      <td className="admin-data-table-meta admin-data-table-nowrap">
                        {payment.stripeCheckoutSessionId ?? "—"}
                      </td>
                      <td className="admin-data-table-meta admin-data-table-nowrap">
                        {new Date(payment.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <nav className="admin-table-pagination" aria-label="Payments pagination">
            <button
              type="button"
              className="clear-btn"
              disabled={paymentsPage <= 1 || paymentsPageLoading}
              onClick={() => void loadPaymentsPage(paymentsPage - 1)}
            >
              Previous
            </button>
            <span className="admin-table-pagination-meta">
              Page {paymentsPage} of {paymentsTotalPages}
              {paymentsTotal > 0 ? ` · ${paymentsTotal} payments` : null}
            </span>
            <button
              type="button"
              className="clear-btn"
              disabled={paymentsPage >= paymentsTotalPages || paymentsPageLoading}
              onClick={() => void loadPaymentsPage(paymentsPage + 1)}
            >
              Next
            </button>
          </nav>
        </div>
      </section>
    );
  }

  function renderSettings() {
    return (
      <Reveal>
        <section className="dashboard-section admin-overview-reveal-scope">
          {actionMessage ? (
            <div className="dashboard-section-header">
              <span className="dashboard-section-note">{actionMessage}</span>
            </div>
          ) : null}
          <div className="admin-overview-layout">
            <div className="admin-overview-block">
              <div className="admin-overview-block-head">
                <strong>Commission rate</strong>
                <span className="admin-overview-tag">Platform</span>
              </div>
              <div className="admin-overview-table-wrap">
                <table className="admin-overview-table">
                  <tbody>
                    <tr>
                      <td>Current</td>
                      <td className="admin-overview-table-num">
                        {settings?.commissionRatePercent ?? overview?.finance.commissionRatePercent ?? 12}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="admin-action-row admin-action-row--tight">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={commissionDraft}
                  onChange={(event) => setCommissionDraft(event.target.value)}
                  className="filter-input"
                />
                <button type="button" className="clear-btn" onClick={updateCommissionRate}>
                  Save commission
                </button>
              </div>
            </div>
          </div>
        </section>
      </Reveal>
    );
  }

  function renderTabContent() {
    switch (activeView) {
      case "overview":
        return renderOverview();
      case "users":
        return renderUsers();
      case "listings":
        return renderListings();
      case "bookings":
        return renderBookings();
      case "reviews":
        return renderReviews();
      case "payments":
        return renderPayments();
      case "settings":
        return renderSettings();
      default:
        return null;
    }
  }

  return (
    <>
    <main className="container dashboard-page admin-page">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="eyebrow">Admin hub</p>
          <p className="subtitle">
            Review analytics, trust operations, catalog quality, and platform finance from one control center.
          </p>
        </div>
        {overview ? (
          <div className="admin-hero-tabs">
            <nav className="dashboard-tab-bar dashboard-tab-bar--header" aria-label="Admin sections">
              {adminTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={tab.id === activeView ? "dashboard-tab active" : "dashboard-tab"}
                  onClick={() => navigateAdminView(tab.id)}
                >
                  <span>{tab.label}</span>
                  {"count" in tab && tab.count != null ? (
                    <span className="dashboard-tab-count">{tab.count}</span>
                  ) : null}
                </button>
              ))}
            </nav>
            <button
              type="button"
              className={
                activeView === "settings"
                  ? "admin-settings-icon-btn active"
                  : "admin-settings-icon-btn"
              }
              onClick={() => navigateAdminView("settings")}
              aria-label="Open settings"
              title="Settings"
            >
              <IconSettingsGear />
            </button>
          </div>
        ) : null}
      </section>

      {!token.trim() ? (
        <section className="dashboard-auth-card dashboard-empty-shell">
          <p className="eyebrow">Secure access</p>
          <h2>Sign in with an admin session.</h2>
          <p className="dashboard-comment">
            The admin area now opens automatically from your saved session instead of exposing a token field.
          </p>
          <div className="dashboard-inline-actions">
            <Link href="/auth" className="hero-primary">
              Sign in
            </Link>
            <Link href="/" className="hero-secondary">
              Back to home
            </Link>
          </div>
        </section>
      ) : status === "loading" && !overview ? (
        <section className="dashboard-auth-card dashboard-empty-shell">
          <p className="eyebrow">Loading workspace</p>
          <div className="dashboard-loading-panel">
            <WindowsLoader label="Preparing admin workspace..." />
          </div>
          <p className="dashboard-comment">
            We are loading analytics, moderation queues, and platform activity.
          </p>
        </section>
      ) : overview ? (
        <>{renderTabContent()}</>
      ) : (
        <section className="dashboard-auth-card dashboard-empty-shell">
          <p className="eyebrow">Access issue</p>
          <h2>We could not open the admin workspace.</h2>
          <p className="dashboard-comment">{message || "Please sign in again with an admin account."}</p>
          <div className="dashboard-inline-actions">
            <Link href="/auth" className="hero-primary">
              Sign in again
            </Link>
            <button type="button" className="clear-btn" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </section>
      )}
    </main>
    {listingEditor && token.trim() ? (
      <AdminListingEditorModal
        apiBase={API_BASE}
        token={token}
        mode={listingEditor.mode}
        listingId={listingEditor.mode === "edit" ? listingEditor.id : null}
        open
        onClose={() => setListingEditor(null)}
        onSaved={() => void reloadListings()}
      />
    ) : null}
    </>
  );
}
