import Link from "next/link";

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string; session_id?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="container">
      <h1>Payment Started</h1>
      <p className="subtitle">
        Stripe returned successfully. If webhook forwarding is configured, your
        booking payment status will update automatically.
      </p>
      {params.bookingId ? (
        <p className="dashboard-meta">Booking ID: {params.bookingId}</p>
      ) : null}
      {params.session_id ? (
        <p className="dashboard-meta">Session ID: {params.session_id}</p>
      ) : null}
      <Link href="/dashboard">Back to dashboard</Link>
    </main>
  );
}
