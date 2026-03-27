import Link from "next/link";

export default async function PaymentCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="container">
      <h1>Payment Cancelled</h1>
      <p className="subtitle">
        Your checkout was cancelled. You can return to the dashboard and try
        again any time.
      </p>
      {params.bookingId ? (
        <p className="dashboard-meta">Booking ID: {params.bookingId}</p>
      ) : null}
      <Link href="/dashboard">Back to dashboard</Link>
    </main>
  );
}
