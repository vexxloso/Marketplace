"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { API_BASE } from "../../lib/api";
import { clearStoredTokens, storeToken } from "../../lib/auth";

type AuthMode = "login" | "register";

export default function AuthPage() {
  const params = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(params.get("mode") === "register" ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"guest" | "host">("guest");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => {
    setMode(params.get("mode") === "register" ? "register" : "login");
  }, [params]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const path = mode === "login" ? "/auth/login" : "/auth/register";
    const body =
      mode === "login"
        ? { email, password }
        : { email, password, name: name || undefined, role };

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.message ?? "Authentication failed");
        return;
      }

      storeToken(data.token, data.user?.role);
      setToken(data.token);
      setStatus("success");
      setMessage(
        mode === "login"
          ? "Logged in. Token saved for dashboard, bookings, reviews, and uploads."
          : "Account created. Token saved for the app.",
      );
    } catch {
      setStatus("error");
      setMessage("Could not reach the API");
    }
  }

  function handleClear() {
    clearStoredTokens();
    setToken("");
    setMessage("Stored tokens cleared.");
    setStatus("success");
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
              : "Create an account to book refined stays as a guest or publish spaces as a host."}
          </p>

          <div className="auth-benefit-list">
            <div className="auth-benefit">
              <strong>Guest access</strong>
              <span>Save favorites, book with transparent pricing, and message hosts in real time.</span>
            </div>
            <div className="auth-benefit">
              <strong>Host access</strong>
              <span>Showcase your property with richer presentation and accept requests or instant bookings.</span>
            </div>
            <div className="auth-benefit">
              <strong>One account surface</strong>
              <span>Everything starts here, then carries across the marketplace automatically on this device.</span>
            </div>
          </div>

          <div className="auth-editorial-visual">
            <img
              src="/auth-lobby.jpg"
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

                <label className="booking-field">
                  <span>Role</span>
                  <select
                    value={role}
                    onChange={(event) =>
                      setRole(event.target.value as "guest" | "host")
                    }
                    className="filter-select"
                  >
                    <option value="guest">Guest</option>
                    <option value="host">Host</option>
                  </select>
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

            {token ? (
              <details className="auth-token-toggle">
                <summary>View saved access token</summary>
                <div className="auth-token-box">
                  <strong>Current token</strong>
                  <code>{token}</code>
                </div>
              </details>
            ) : null}
          </form>
        </div>
      </section>
    </main>
  );
}
