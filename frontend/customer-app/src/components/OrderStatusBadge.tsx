import type { OrderStatus } from '../api/orders';

const LABELS: Record<OrderStatus, string> = {
  PLACED: 'Awaiting payment',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY: 'Ready',
  PICKED_UP: 'On the way',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

function colorClass(status: OrderStatus): string {
  switch (status) {
    case 'PLACED':
      return 'bg-brand-tint text-brand';
    case 'CANCELLED':
      return 'bg-danger/10 text-danger';
    case 'DELIVERED':
    case 'COMPLETED':
      return 'bg-divider text-muted';
    default:
      return 'bg-success/10 text-success';
  }
}

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-2xl px-3 py-1 font-body text-xs font-medium ${colorClass(status)}`}
    >
      {status === 'PLACED' && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" aria-hidden="true" />
      )}
      {LABELS[status]}
    </span>
  );
}
