import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getRestaurantById, type RestaurantDetail as RestaurantDetailData } from '../api/restaurants';
import OpenBadge from '../components/OpenBadge';

export default function RestaurantDetail() {
  const { id } = useParams<{ id: string }>();

  const [restaurant, setRestaurant] = useState<RestaurantDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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
        <Link to="/home" className="font-body text-sm text-brand hover:text-brand-dark">
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
                      <span className="font-body text-sm font-medium text-charcoal">
                        {Number(item.price).toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
