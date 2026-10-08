import { useState } from 'react';
import { acceptOrder, markOrderReady, rejectOrder, type Order } from '../api/orders';
import { apiErrorMessage, formatPrice, formatTime, itemCount, orderRef } from '../lib/format';

interface OrderCardProps {
  order: Order;
  /** Called with the order as the server returned it after an action. */
  onChanged: (order: Order) => void;
  /** Called when an action failed, e.g. because the customer just cancelled. */
  onStale: () => void;
}

const MAX_REASON_LENGTH = 200;

export default function OrderCard({ order, onChanged, onStale }: OrderCardProps) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [reason, setReason] = useState('');

  async function run(action: () => Promise<Order>, fallback: string) {
    setIsBusy(true);
    setError('');
    try {
      onChanged(await action());
      setIsRejecting(false);
    } catch (err) {
      setError(apiErrorMessage(err, fallback));
      // Most failures mean the order changed under us (e.g. the customer
      // cancelled); reload so the board shows its real status.
      onStale();
    } finally {
      setIsBusy(false);
    }
  }

  const quantity = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const isNew = order.status === 'CONFIRMED';

  return (
    <article
      aria-label={`Order ${orderRef(order.id)}`}
      className={`rounded-2xl bg-panel p-4 shadow-elevation-low ${isNew ? 'ring-2 ring-brand/40' : ''}`}
    >
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-[17px] font-semibold text-charcoal">{orderRef(order.id)}</h3>
        {order.confirmedAt && (
          <span className="font-body text-xs text-muted">Paid {formatTime(order.confirmedAt)}</span>
        )}
      </header>

      <ul className="mt-3 flex flex-col gap-1">
        {order.lines.map((line) => (
          <li key={line.id} className="flex justify-between gap-2 font-body text-sm text-charcoal">
            <span>
              <span className="font-medium">{line.quantity} ×</span> {line.name}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 flex justify-between border-t border-divider pt-3 font-body text-sm text-muted">
        <span>{itemCount(quantity)}</span>
        <span className="font-medium text-charcoal">{formatPrice(order.totalAmount)}</span>
      </p>

      {error && (
        <p role="alert" className="mt-3 font-body text-xs text-danger">
          {error}
        </p>
      )}

      {isRejecting ? (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => rejectOrder(order.id, reason), 'Could not reject this order.');
          }}
        >
          <label className="font-body text-xs text-charcoal" htmlFor={`reason-${order.id}`}>
            Reason for the customer (optional)
          </label>
          <input
            id={`reason-${order.id}`}
            value={reason}
            maxLength={MAX_REASON_LENGTH}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Out of mozzarella"
            className="rounded-2xl border border-divider bg-canvas px-3 py-2 font-body text-sm text-charcoal outline-none focus:border-brand"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isBusy}
              className="flex-1 rounded-2xl bg-danger px-3 py-2 font-display text-sm font-medium text-white hover:bg-danger/90 disabled:opacity-60"
            >
              {isBusy ? 'Rejecting…' : 'Reject and refund'}
            </button>
            <button
              type="button"
              onClick={() => setIsRejecting(false)}
              className="rounded-2xl px-3 py-2 font-display text-sm font-medium text-muted hover:text-charcoal"
            >
              Keep order
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex gap-2">
          {order.status === 'CONFIRMED' && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => run(() => acceptOrder(order.id), 'Could not accept this order.')}
              className="flex-1 rounded-2xl bg-brand px-3 py-2 font-display text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            >
              Accept
            </button>
          )}
          {order.status === 'PREPARING' && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => run(() => markOrderReady(order.id), 'Could not mark this order ready.')}
              className="flex-1 rounded-2xl bg-brand px-3 py-2 font-display text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            >
              Mark ready
            </button>
          )}
          {order.status === 'READY' && (
            <p className="flex-1 font-body text-sm text-muted">Waiting for pickup</p>
          )}
          {(order.status === 'CONFIRMED' || order.status === 'PREPARING') && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setIsRejecting(true)}
              className="rounded-2xl px-3 py-2 font-display text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-60"
            >
              Reject
            </button>
          )}
        </div>
      )}
    </article>
  );
}
