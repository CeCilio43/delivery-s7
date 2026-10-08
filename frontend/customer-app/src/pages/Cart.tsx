import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { placeOrder } from '../api/orders';
import AppNav from '../components/AppNav';
import Button from '../components/Button';
import { apiErrorMessage, formatPrice } from '../lib/format';

export default function Cart() {
  const { cart, total, setQuantity, clear } = useCart();
  const navigate = useNavigate();

  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState('');

  async function handlePlaceOrder() {
    if (!cart) return;
    setError('');
    setIsPlacing(true);
    try {
      const order = await placeOrder({
        restaurantId: cart.restaurantId,
        items: cart.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
      });
      clear();
      navigate(`/orders/${order.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Something went wrong placing your order.'));
      setIsPlacing(false);
    }
  }

  return (
    <div className="min-h-screen bg-divider">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <AppNav />

        <h1 className="mt-8 font-display text-[28px] font-semibold text-charcoal">Your cart</h1>

        {!cart ? (
          <div className="mt-6 rounded-2xl bg-white p-6 shadow-elevation-low">
            <p className="font-body text-sm text-muted">Your cart is empty.</p>
            <Link
              to="/home"
              className="mt-4 inline-block font-body text-sm text-brand hover:text-brand-dark"
            >
              Browse restaurants →
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-2 font-body text-sm text-muted">
              From{' '}
              <Link
                to={`/restaurants/${cart.restaurantId}`}
                className="text-brand hover:text-brand-dark"
              >
                {cart.restaurantName}
              </Link>
            </p>

            <div className="mt-6 flex flex-col gap-4">
              {cart.items.map((item) => (
                <div
                  key={item.menuItemId}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-elevation-low"
                >
                  <div>
                    <h3 className="font-display text-[18px] font-medium text-charcoal">
                      {item.name}
                    </h3>
                    <p className="mt-1 font-body text-sm text-muted">
                      {formatPrice(item.price)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Remove one ${item.name}`}
                        onClick={() => setQuantity(item.menuItemId, item.quantity - 1)}
                        className="h-8 w-8 rounded-2xl bg-divider font-display text-charcoal hover:bg-[#e8e8eb]"
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-body text-sm font-medium text-charcoal">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`Add one ${item.name}`}
                        onClick={() => setQuantity(item.menuItemId, item.quantity + 1)}
                        className="h-8 w-8 rounded-2xl bg-divider font-display text-charcoal hover:bg-[#e8e8eb]"
                      >
                        +
                      </button>
                    </div>
                    <span className="w-16 text-right font-body text-sm font-medium text-charcoal">
                      {formatPrice(Number(item.price) * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl bg-white p-6 shadow-elevation-low">
              <div className="flex items-center justify-between">
                <span className="font-display text-[18px] font-medium text-charcoal">Total</span>
                <span className="font-display text-[18px] font-semibold text-charcoal">
                  {formatPrice(total)}
                </span>
              </div>
              {error && <p className="mt-4 font-body text-sm text-danger">{error}</p>}
              <Button className="mt-6" disabled={isPlacing} onClick={handlePlaceOrder}>
                {isPlacing ? 'Placing order…' : 'Place order'}
              </Button>
              <button
                type="button"
                onClick={clear}
                disabled={isPlacing}
                className="mt-3 w-full font-body text-sm text-muted hover:text-charcoal disabled:opacity-60"
              >
                Clear cart
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
