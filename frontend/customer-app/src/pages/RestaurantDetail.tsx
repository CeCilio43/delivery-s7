import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getRestaurantById, type RestaurantDetail as RestaurantDetailData } from '../api/restaurants';
import { addItemToCart } from '../api/cart';
import { useCart } from '../context/CartContext';
import AppNav from '../components/AppNav';
import OpenBadge from '../components/OpenBadge';
import Button from '../components/Button';

export default function RestaurantDetail() {
  const { id } = useParams<{ id: string }>();

  const [restaurant, setRestaurant] = useState<RestaurantDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { cart, itemCount, addItem } = useCart();
  const [startedNewCart, setStartedNewCart] = useState(false);

  const handleAddToCart = (item: RestaurantDetailData['menuItems'][number]) => {
    if (!restaurant) return;
    const replaced = addItem(
      { id: restaurant.id, name: restaurant.name },
      { menuItemId: item.id, name: item.name, price: item.price },
    );
    if (replaced) setStartedNewCart(true);

    // Still fires the hello.world event-bus demo, which notification-service
    // pushes back as a toast. Fire-and-forget: the cart itself lives in the
    // browser, so a failed publish doesn't affect it.
    addItemToCart(restaurant.id, item.id).catch(() => {});
  };

  const cartIsForThisRestaurant = cart !== null && cart.restaurantId === id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);
    setError('');

    getRestaurantById(id)
      .then((data) => {
        if (!cancelled) setRestaurant(data);
      })
      .catch(() => {
        if (!cancelled) setError('Something went wrong loading this restaurant.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-divider">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <AppNav />

        <Link
          to="/home"
          className="mt-8 inline-block font-body text-sm text-brand hover:text-brand-dark"
        >
          ← Back to restaurants
        </Link>

        <div className="mt-6">
          {isLoading ? (
            <div className="flex flex-col gap-6">
              <div className="h-24 animate-pulse rounded-2xl bg-white shadow-elevation-low" />
              <div className="h-16 animate-pulse rounded-2xl bg-white shadow-elevation-low" />
              <div className="h-16 animate-pulse rounded-2xl bg-white shadow-elevation-low" />
            </div>
          ) : error ? (
            <p className="font-body text-sm text-danger">{error}</p>
          ) : !restaurant ? (
            <p className="font-body text-sm text-muted">Restaurant not found.</p>
          ) : (
            <>
              <div className="rounded-2xl bg-white p-6 shadow-elevation-low">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="font-display text-[28px] font-semibold text-charcoal">
                      {restaurant.name}
                    </h1>
                    <p className="mt-2 font-body text-sm text-muted">
                      {restaurant.cuisine ?? 'Cuisine not listed'}
                    </p>
                  </div>
                  <OpenBadge isOpen={restaurant.isOpen} />
                </div>
                <p className="mt-4 font-body text-sm text-charcoal">{restaurant.address}</p>
              </div>

              {startedNewCart && (
                <p className="mt-6 rounded-2xl bg-brand-tint px-4 py-3 font-body text-sm text-brand">
                  An order can only come from one restaurant, so we started a new cart for{' '}
                  {restaurant.name}.
                </p>
              )}

              <h2 className="mt-8 font-display text-[18px] font-medium text-charcoal">Menu</h2>
              <div className="mt-4 flex flex-col gap-4">
                {restaurant.menuItems.length === 0 ? (
                  <p className="font-body text-sm text-muted">No menu items yet.</p>
                ) : (
                  restaurant.menuItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-elevation-low"
                    >
                      <div>
                        <h3 className="font-display text-[18px] font-medium text-charcoal">
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="mt-1 font-body text-sm text-muted">{item.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-body text-sm font-medium text-charcoal">
                          {Number(item.price).toFixed(2)}
                        </span>
                        <Button
                          variant="secondary"
                          className="w-auto px-4 py-2 text-[13px]"
                          disabled={!restaurant.isOpen || !item.isAvailable}
                          onClick={() => handleAddToCart(item)}
                        >
                          {item.isAvailable ? 'Add to cart' : 'Unavailable'}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cartIsForThisRestaurant && itemCount > 0 && (
                <Link
                  to="/cart"
                  className="sticky bottom-4 mt-6 flex items-center justify-between rounded-2xl bg-brand px-6 py-4 font-display text-[15px] font-medium text-white shadow-elevation-high transition-colors hover:bg-brand-dark"
                >
                  <span>View cart ({itemCount})</span>
                  <span>→</span>
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
