import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOrders, isAwaitingPayment, type Order } from '../api/orders';
import { getRestaurants } from '../api/restaurants';
import AppNav from '../components/AppNav';
import OrderStatusBadge from '../components/OrderStatusBadge';
import { useNotifications, useOrderUpdates } from '../context/NotificationContext';
import { usePolling, ORDER_POLL_INTERVAL_MS } from '../hooks/usePolling';
import { formatDateTime, formatPrice } from '../lib/format';

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [restaurantNames, setRestaurantNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(() => {
    getOrders()
      .then((data) => {
        setOrders(data);
        setError('');
      })
      .catch(() => setError('Something went wrong loading your orders.'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    // Orders only carry a restaurantId; names are a nice-to-have.
    getRestaurants()
      .then((restaurants) =>
        setRestaurantNames(Object.fromEntries(restaurants.map((r) => [r.id, r.name]))),
      )
      .catch(() => {});
  }, [refresh]);

  // Status changes are pushed over the websocket; polling only remains as a
  // slow safety net, and speeds up while the socket is disconnected.
  const { isConnected } = useNotifications();
  useOrderUpdates(refresh);
  usePolling(
    refresh,
    orders.some(isAwaitingPayment),
    isConnected ? ORDER_POLL_INTERVAL_MS.connected : ORDER_POLL_INTERVAL_MS.disconnected,
  );

  return (
    <div className="min-h-screen bg-divider">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <AppNav />

        <h1 className="mt-8 font-display text-[28px] font-semibold text-charcoal">My orders</h1>

        <div className="mt-6">
          {isLoading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-2xl bg-white shadow-elevation-low"
                />
              ))}
            </div>
          ) : error ? (
            <p className="font-body text-sm text-danger">{error}</p>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl bg-white p-6 shadow-elevation-low">
              <p className="font-body text-sm text-muted">You haven't placed any orders yet.</p>
              <Link
                to="/home"
                className="mt-4 inline-block font-body text-sm text-brand hover:text-brand-dark"
              >
                Browse restaurants →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="rounded-2xl bg-white p-6 shadow-elevation-low transition-shadow hover:shadow-elevation-high"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-[18px] font-medium text-charcoal">
                        {restaurantNames[order.restaurantId] ?? 'Restaurant'}
                      </h2>
                      <p className="mt-1 font-body text-sm text-muted">
                        {formatDateTime(order.createdAt)} ·{' '}
                        {order.lines.reduce((sum, line) => sum + line.quantity, 0)} items
                      </p>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <p className="mt-4 font-body text-sm font-medium text-charcoal">
                    {formatPrice(order.totalAmount)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
