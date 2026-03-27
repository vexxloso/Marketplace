import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maison Noir",
  description: "Curated luxury stays and elevated travel experiences.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="site-shell">
          <header className="site-header">
            <div className="site-header-inner">
              <Link href="/" className="nav-brand">
                <span className="nav-brand-mark">MN</span>
                <span className="nav-brand-copy">
                  <span className="nav-brand-name">Maison Noir</span>
                  <span className="nav-brand-tag">Luxury stays marketplace</span>
                </span>
              </Link>

              <nav className="nav nav-primary">
                <Link href="/listings">Explore stays</Link>
                <Link href="/listings?sort=rating_desc">Top rated</Link>
                <Link href="/auth?mode=register">Become a host</Link>
              </nav>

              <div className="nav-utility">
                <Link href="/auth" className="nav-utility-link">
                  Sign in
                </Link>
                <Link href="/dashboard" className="nav-utility-link">
                  Account
                </Link>
                <Link href="/admin" className="nav-cta">
                  Admin
                </Link>
              </div>
            </div>
          </header>

          <div className="site-main">{children}</div>

          <footer className="site-footer">
            <div className="site-footer-inner">
              <div>
                <strong>Maison Noir</strong>
                <p className="site-footer-copy">
                  Curated properties for guests who want atmosphere, privacy, and memorable stays.
                </p>
              </div>
              <div className="site-footer-links">
                <Link href="/listings">Browse stays</Link>
                <Link href="/auth">Sign in</Link>
                <Link href="/dashboard">Dashboard</Link>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
