import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { cancelOrder, getOrder, isAwaitingPayment, isCancellable, type Order } from '../api/orders';
import { getPaymentsForOrder, type Payment } from '../api/payments';
import { getRestaurantById } from '../api/restaurants';
import AppNav from '../components/AppNav';
import OrderStatusBadge from '../components/OrderStatusBadge';
import { useNotifications, useOrderUpdates } from '../context/NotificationContext';
import { usePolling, ORDER_POLL_INTERVAL_MS } from '../hooks/usePolling';
import { apiErrorMessage, formatDateTime, formatPrice } from '../lib/format';

function statusMessage(order: Order, payment: Payment | undefined): string {
  switch (order.status) {
    case 'PLACED':
      return 'Processing your payment…';
    case 'CONFIRMED':
      return 'Payment received. The restaurant has your order.';
    case 'CANCELLED':
      if (payment?.status === 'FAILED') {
        return 'Your payment was declined, so this order was cancelled.';
      }
      if (payment?.status === 'REFUNDED') {
        return `This order was cancelled and your payment of ${formatPrice(payment.amount)} was refunded.`;
      }
      return 'This order was cancelled.';
    default:
      return '';
  }
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<Payment | undefined>();
  const [restaurantName, setRestaurantName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const refresh = useCallback(() => {
    if (!id) return;
    getOrder(id)
      .then((orderData) => {
        setOrder(orderData);
        setError('');
        // Payment status only refines the message for a cancellation
        // (declined card vs. refund). Fetched separately, and only then, so
        // the order still renders and polls while payment-service is slow
        // or down.
        if (orderData.status === 'CANCELLED') {
          getPaymentsForOrder(id)
            .then((payments) => setPayment(payments[0]))
            .catch(() => {});
        }
      })
      .catch((err) => {
        setError(
          isAxiosError(err) && err.response?.status === 404
            ? 'Order not found.'
            : 'Something went wrong loading this order.',
        );
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Keyed on the id, not the order, so polling doesn't refetch the name.
  const restaurantId = order?.restaurantId;
  useEffect(() => {
    if (!restaurantId) return;
    getRestaurantById(restaurantId)
      .then((restaurant) => setRestaurantName(restaurant.name))
      .catch(() => {});
  }, [restaurantId]);

  // Status changes are pushed over the websocket; polling only remains as a
  // slow safety net, and speeds up while the socket is disconnected.
  const { isConnected } = useNotifications();
  useOrderUpdates((update) => {
    if (update.orderId === id) refresh();
  });
  usePolling(
    refresh,
    order !== null && isAwaitingPayment(order),
    isConnected ? ORDER_POLL_INTERVAL_MS.connected : ORDER_POLL_INTERVAL_MS.disconnected,
  );

  async function handleCancel() {
    if (!id) return;
    setCancelError('');
    setIsCancelling(true);
    try {
      setOrder(await cancelOrder(id));
      // The refund happens asynchronously on the event bus; pick it up.
      setTimeout(refresh, 1000);
    } catch (err) {
      setCancelError(apiErrorMessage(err, 'Something went wrong cancelling this order.'));
      refresh();
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <div className="min-h-screen bg-divider">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <AppNav />

        <Link
          to="/orders"
          className="mt-8 inline-block font-body text-sm text-brand hover:text-brand-dark"
        >
          ← Back to my orders
        </Link>

        <div className="mt-6">
          {isLoading ? (
            <div className="flex flex-col gap-6">
              <div className="h-28 animate-pulse rounded-2xl bg-white shadow-elevation-low" />
              <div className="h-40 animate-pulse rounded-2xl bg-white shadow-elevation-low" />
            </div>
          ) : error || !order ? (
            <p className="font-body text-sm text-danger">{error || 'Order not found.'}</p>
          ) : (
            <>
              <div className="rounded-2xl bg-white p-6 shadow-elevation-low">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="font-display text-[28px] font-semibold text-charcoal">
                      {restaurantName || 'Your order'}
                    </h1>
                    <p className="mt-2 font-body text-sm text-muted">
                      Placed {formatDateTime(order.createdAt)}
                    </p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>
                {statusMessage(order, payment) && (
                  <p
                    className={`mt-4 font-body text-sm ${
                      order.status === 'CANCELLED' ? 'text-danger' : 'text-charcoal'
                    }`}
                    aria-live="polite"
                  >
                    {statusMessage(order, payment)}
                  </p>
                )}
              </div>

              <h2 className="mt-8 font-display text-[18px] font-medium text-charcoal">Items</h2>
              <div className="mt-4 rounded-2xl bg-white p-6 shadow-elevation-low">
                <div className="flex flex-col gap-3">
                  {order.lines.map((line) => (
                    <div key={line.id} className="flex items-center justify-between gap-4">
                      <span className="font-body text-sm text-charcoal">
                        {line.quantity} × {line.name}
                      </span>
                      <span className="font-body text-sm text-charcoal">
                        {formatPrice(Number(line.unitPrice) * line.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-divider pt-4">
                  <span className="font-display text-[18px] font-medium text-charcoal">Total</span>
                  <span className="font-display text-[18px] font-semibold text-charcoal">
                    {formatPrice(order.totalAmount)}
                  </span>
                </div>
              </div>

              {isCancellable(order) && (
                <div className="mt-6">
                  {cancelError && (
                    <p className="mb-4 font-body text-sm text-danger">{cancelError}</p>
                  )}
                  {/* Not <Button variant="secondary">: its grey matches the page
                      background, so it wouldn't read as a button here. */}
                  <button
                    type="button"
                    disabled={isCancelling}
                    onClick={handleCancel}
                    className="w-full rounded-2xl bg-white px-6 py-4 font-display text-[15px] font-medium text-danger shadow-elevation-low transition-colors hover:bg-danger/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCancelling ? 'Cancelling…' : 'Cancel order'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
