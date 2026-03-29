"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { API_BASE } from "../../lib/api";
import { publicUrl } from "../../lib/base-path";
import { clearStoredTokens, getStoredToken, storeToken } from "../../lib/auth";

function safeReturnPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

type AuthMode = "login" | "register";

function formatAuthFailureMessage(data: {
  message?: string;
  errors?: Record<string, string[] | undefined>;
}) {
  const base = data.message ?? "Authentication failed";
  const errs = data.errors;
  if (!errs || typeof errs !== "object") return base;
  const parts = Object.entries(errs).flatMap(([key, msgs]) =>
    (msgs ?? []).map((m) => `${key}: ${m}`),
  );
  if (parts.length === 0) return base;
  return `${base} — ${parts.join("; ")}`;
}

function AuthPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(params.get("mode") === "register" ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    setMode(params.get("mode") === "register" ? "register" : "login");
  }, [params]);

  useEffect(() => {
    let cancelled = false;
    const existing = getStoredToken().trim();
    if (!existing) {
      setSessionChecked(true);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${existing}` },
        });
        if (cancelled) return;
        if (res.ok) {
          const returnTo = safeReturnPath(params.get("returnUrl"));
          router.replace(returnTo ?? "/dashboard");
          return;
        }
      } catch {
        /* stay on auth */
      }
      setSessionChecked(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [params, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const path = mode === "login" ? "/auth/login" : "/auth/register";
    const body =
      mode === "login"
        ? { email, password }
        : { email, password, name: name || undefined };

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(formatAuthFailureMessage(data));
        return;
      }

      storeToken(data.token, data.user?.role);
      setStatus("success");
      const returnTo = safeReturnPath(params.get("returnUrl"));
      router.replace(returnTo ?? "/dashboard");
    } catch {
      setStatus("error");
      setMessage("Could not reach the API");
    }
  }

  function handleClear() {
    clearStoredTokens();
    setMessage("Stored tokens cleared.");
    setStatus("success");
  }

  if (!sessionChecked) {
    return (
      <main className="container auth-page auth-luxury-page">
        <p className="dashboard-comment" style={{ padding: "48px 0", textAlign: "center" }}>
          Checking your session…
        </p>
      </main>
    );
  }

  return (
    <main className="container auth-page auth-luxury-page">
      <section className="auth-luxury-layout">
        <div className="auth-editorial-panel">
          <p className="eyebrow">Maison Noir access</p>
          <h1>{mode === "login" ? "Return to your next stay." : "Join the marketplace."}</h1>
          <p className="subtitle">
            {mode === "login"
              ? "Sign in to manage reservations, messages, reviews, and your account experience."
              : "Create an account to book stays, message about trips, and manage your Maison Noir profile."}
          </p>

          <div className="auth-editorial-visual">
            <img
              src={publicUrl("/home-visual-3.jpg")}
              alt="Luxury hotel lobby"
              className="auth-editorial-image"
            />
          </div>

          <Link href="/listings" className="hero-inline-link">
            Continue browsing stays
          </Link>
        </div>

        <div className="dashboard-auth-card auth-card auth-card-luxury">
          <div className="auth-toggle-row">
            <button
              type="button"
              className={mode === "login" ? "auth-toggle active" : "auth-toggle"}
              onClick={() => setMode("login")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === "register" ? "auth-toggle active" : "auth-toggle"}
              onClick={() => setMode("register")}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === "register" ? (
              <>
                <label className="booking-field">
                  <span>Name</span>
                  <input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>

              </>
            ) : null}

            <label className="booking-field">
              <span>Email</span>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label className="booking-field">
              <span>Password</span>
              <input
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </label>

            <div className="dashboard-auth-actions">
              <button type="submit" className="book-btn" disabled={status === "loading"}>
                {status === "loading"
                  ? mode === "login"
                    ? "Signing in..."
                    : "Creating..."
                  : mode === "login"
                    ? "Enter Maison Noir"
                    : "Create your account"}
              </button>
              <button type="button" className="clear-btn" onClick={handleClear}>
                Clear local access
              </button>
            </div>

            {message ? (
              <p className={status === "error" ? "booking-error" : "booking-success"}>
                {message}
              </p>
            ) : null}
          </form>
        </div>
      </section>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="container auth-page auth-luxury-page">
          <p className="dashboard-comment" style={{ padding: "48px 0", textAlign: "center" }}>
            Loading…
          </p>
        </main>
      }
    >
      <AuthPageContent />
    </Suspense>
  );
}
