import { Suspense } from "react";

import AdminClient from "./AdminClient";

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main className="container dashboard-page admin-page">
          <p className="eyebrow">Admin hub</p>
          <p className="subtitle">Loading…</p>
        </main>
      }
    >
      <AdminClient />
    </Suspense>
  );
}
