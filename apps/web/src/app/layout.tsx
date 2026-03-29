import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import { FooterAuthNav, HeaderAuthNav } from "../components/SiteAuthNav";
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
                <Link href="/auth?mode=register">Create account</Link>
              </nav>

              <HeaderAuthNav />
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
              <FooterAuthNav />
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
