"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { API_BASE } from "../lib/api";
import { getStoredToken, signOut, subscribeAuthChanged } from "../lib/auth";

type MeResponse = {
  user?: { role?: string };
};

function useSessionNav() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const refresh = useCallback(async () => {
    const token = getStoredToken().trim();
    if (!token) {
      setSignedIn(false);
      setIsAdmin(false);
      setReady(true);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = (await res.json()) as MeResponse;
      if (!res.ok) {
        setSignedIn(false);
        setIsAdmin(false);
        setReady(true);
        return;
      }
      setSignedIn(true);
      setIsAdmin(data.user?.role === "admin");
    } catch {
      setSignedIn(false);
      setIsAdmin(false);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return subscribeAuthChanged(() => {
      void refresh();
    });
  }, [refresh]);

  return { ready, signedIn, isAdmin };
}

export function HeaderAuthNav() {
  const router = useRouter();
  const { ready, signedIn, isAdmin } = useSessionNav();

  function handleSignOut() {
    signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="nav-utility">
      {!ready ? (
        <span className="nav-utility-link nav-utility-placeholder" aria-hidden>
          ···
        </span>
      ) : signedIn ? (
        <>
          <Link href="/dashboard" className="nav-utility-link">
            Account
          </Link>
          <button type="button" className="nav-utility-signout" onClick={handleSignOut}>
            Sign out
          </button>
        </>
      ) : (
        <Link href="/auth" className="nav-utility-link">
          Sign in
        </Link>
      )}
      {ready && isAdmin ? (
        <Link href="/admin" className="nav-cta">
          Admin
        </Link>
      ) : null}
    </div>
  );
}

export function FooterAuthNav() {
  const router = useRouter();
  const { ready, signedIn } = useSessionNav();

  function handleSignOut() {
    signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="site-footer-links">
      <Link href="/listings">Browse stays</Link>
      {!ready ? null : signedIn ? (
        <>
          <Link href="/dashboard">Account</Link>
          <button type="button" className="site-footer-signout" onClick={handleSignOut}>
            Sign out
          </button>
        </>
      ) : (
        <Link href="/auth">Sign in</Link>
      )}
    </div>
  );
}
