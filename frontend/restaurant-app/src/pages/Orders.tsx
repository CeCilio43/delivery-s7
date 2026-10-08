import { useCallback, useEffect, useState } from 'react';
import { ACTIVE_STATUSES, getRestaurantOrders, type Order, type OrderStatus } from '../api/orders';
import OrderCard from '../components/OrderCard';
import Page from '../components/Page';
import { useNotifications, useOrderUpdates } from '../context/NotificationContext';
import { useRestaurant } from '../context/RestaurantContext';
import { ORDER_POLL_INTERVAL_MS, usePolling } from '../hooks/usePolling';
import { formatDateTime, formatPrice, orderRef } from '../lib/format';

const COLUMNS: { status: OrderStatus; title: string; empty: string }[] = [
  { status: 'CONFIRMED', title: 'New', empty: 'No new orders.' },
  { status: 'PREPARING', title: 'Preparing', empty: 'Nothing being prepared.' },
  { status: 'READY', title: 'Ready', empty: 'Nothing waiting for pickup.' },
];

const HISTORY_STATUSES: OrderStatus[] = ['PICKED_UP', 'DELIVERED', 'COMPLETED', 'CANCELLED'];
const HISTORY_LIMIT = 20;

const HISTORY_LABELS: Partial<Record<OrderStatus, string>> = {
  PICKED_UP: 'Picked up',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export default function Orders() {
  const { restaurant } = useRestaurant();
  const { isConnected } = useNotifications();
  const restaurantId = restaurant?.id;

  const [active, setActive] = useState<Order[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(() => {
    if (!restaurantId) return;
    Promise.all([
      getRestaurantOrders(restaurantId, ACTIVE_STATUSES),
      getRestaurantOrders(restaurantId, HISTORY_STATUSES),
    ])
      .then(([activeOrders, pastOrders]) => {
        setActive(activeOrders);
        // The API lists oldest first; history reads best newest first.
        setHistory(pastOrders.slice(-HISTORY_LIMIT).reverse());
        setError('');
      })
      .catch(() => setError('Something went wrong loading orders.'))
      .finally(() => setHasLoaded(true));
  }, [restaurantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // New orders and cancellations are pushed; polling is the safety net.
  useOrderUpdates((update) => {
    if (update.restaurantId === restaurantId) refresh();
  });
  usePolling(
    refresh,
    restaurantId !== undefined,
    isConnected ? ORDER_POLL_INTERVAL_MS.connected : ORDER_POLL_INTERVAL_MS.disconnected,
  );

  function handleChanged(updated: Order) {
    // Show the new status right away; the refresh confirms it.
    setActive((current) => current.map((o) => (o.id === updated.id ? updated : o)));
    refresh();
  }

  return (
    <Page
      title="Orders"
      actions={
        <span className="flex items-center gap-2 font-body text-xs text-muted">
          <span
            className={`h-2 w-2 rounded-full ${isConnected ? 'bg-success' : 'bg-muted'}`}
            aria-hidden="true"
          />
          {isConnected ? 'Live' : 'Reconnecting…'}
        </span>
      }
    >
      {error && (
        <p role="alert" className="mb-4 font-body text-sm text-danger">
          {error}
        </p>
      )}

      {restaurant && !restaurant.isOpen && (
        <p className="mb-4 rounded-2xl bg-panel px-4 py-3 font-body text-sm text-muted shadow-elevation-low">
          {restaurant.name} is closed, so customers can't place new orders. Use the toggle at the
          top to open.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {COLUMNS.map((column) => {
          const orders = active.filter((o) => o.status === column.status);
          return (
            <section key={column.status} aria-label={column.title} className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 font-display text-[18px] font-medium text-charcoal">
                {column.title}
                <span className="rounded-2xl bg-panel px-2 py-0.5 font-body text-xs text-muted">
                  {orders.length}
                </span>
              </h2>
              {!hasLoaded ? (
                <div className="h-32 animate-pulse rounded-2xl bg-panel shadow-elevation-low" />
              ) : orders.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-divider px-4 py-6 text-center font-body text-sm text-muted">
                  {column.empty}
                </p>
              ) : (
                orders.map((order) => (
                  <OrderCard key={order.id} order={order} onChanged={handleChanged} onStale={refresh} />
                ))
              )}
            </section>
          );
        })}
      </div>

      <section aria-label="Recent orders" className="mt-10">
        <h2 className="font-display text-[18px] font-medium text-charcoal">Recent orders</h2>
        {hasLoaded && history.length === 0 ? (
          <p className="mt-3 font-body text-sm text-muted">No finished or cancelled orders yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-divider rounded-2xl bg-panel shadow-elevation-low">
            {history.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="font-body text-sm font-medium text-charcoal">{orderRef(order.id)}</span>
                <span className="font-body text-xs text-muted">
                  {order.confirmedAt ? formatDateTime(order.confirmedAt) : ''}
                </span>
                <span className="font-body text-sm text-charcoal">{formatPrice(order.totalAmount)}</span>
                <span
                  className={`rounded-2xl px-3 py-1 font-body text-xs font-medium ${
                    order.status === 'CANCELLED' ? 'bg-danger/10 text-danger' : 'bg-canvas text-muted'
                  }`}
                >
                  {HISTORY_LABELS[order.status] ?? order.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}
