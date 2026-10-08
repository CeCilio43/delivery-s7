import AppNav from '../components/AppNav';

// Placeholder until order-service has owner endpoints (listing a
// restaurant's orders and moving them to PREPARING / READY).
export default function Orders() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <AppNav />

        <h1 className="mt-8 font-display text-[28px] font-semibold text-charcoal">
          Incoming orders
        </h1>

        <div className="mt-6 rounded-2xl bg-panel p-6 shadow-elevation-low">
          <p className="font-body text-sm text-charcoal">No orders to show yet.</p>
          <p className="mt-2 font-body text-sm text-muted">
            Confirmed orders for your restaurant will appear here once order management is
            connected.
          </p>
        </div>
      </div>
    </div>
  );
}
