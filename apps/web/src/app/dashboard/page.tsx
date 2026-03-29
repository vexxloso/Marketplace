import { Suspense } from "react";

import DashboardClient from "./DashboardClient";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="container dashboard-page">
          <p className="eyebrow">Account hub</p>
          <p className="subtitle">Loading…</p>
        </main>
      }
    >
      <DashboardClient />
    </Suspense>
  );
}
