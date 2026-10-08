import { useState } from 'react';
import { payPayment, type Payment } from '../api/payments';
import { apiErrorMessage, formatPrice } from '../lib/format';
import Button from './Button';

interface PayNowButtonProps {
  /** A PENDING payment. */
  payment: Payment;
  /** Called with the payment once charged (SUCCEEDED, or FAILED if declined). */
  onPaid: (payment: Payment) => void;
  /** Called when paying went wrong, e.g. to reload the payment's current state. */
  onError?: () => void;
}

/**
 * Mock "Pay now": payment-service charges the payment with its simulated
 * provider; order-service then confirms (or cancels) the order over the
 * event bus, which is pushed to the page.
 */
export default function PayNowButton({ payment, onPaid, onError }: PayNowButtonProps) {
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState('');

  async function handlePay() {
    setError('');
    setIsPaying(true);
    try {
      onPaid(await payPayment(payment.id));
    } catch (err) {
      setError(apiErrorMessage(err, 'Something went wrong with your payment. Please try again.'));
      onError?.();
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <div>
      {error && <p className="mb-4 font-body text-sm text-danger">{error}</p>}
      <Button type="button" disabled={isPaying} onClick={handlePay}>
        {isPaying ? 'Paying…' : `Pay now · ${formatPrice(payment.amount)}`}
      </Button>
    </div>
  );
}
