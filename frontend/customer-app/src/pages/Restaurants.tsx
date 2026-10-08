import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRestaurants, type RestaurantSummary } from '../api/restaurants';
import AppNav from '../components/AppNav';
import OpenBadge from '../components/OpenBadge';

export default function Restaurants() {
  const [search, setSearch] = useState('');
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');

    getRestaurants(search || undefined)
      .then((data) => {
        if (!cancelled) setRestaurants(data);
      })
      .catch(() => {
        if (!cancelled) setError('Something went wrong loading restaurants.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [search]);

  return (
    <div className="min-h-screen bg-divider">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <AppNav />

        <h1 className="mt-8 font-display text-[28px] font-semibold text-charcoal">Restaurants</h1>

        <input
          type="search"
          placeholder="Search by name or cuisine"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="mt-6 w-full rounded-2xl border border-divider bg-white px-4 py-4 font-body text-sm text-charcoal outline-none focus:border-brand"
        />

        <div className="mt-8">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-36 animate-pulse rounded-2xl bg-white shadow-elevation-low"
                />
              ))}
            </div>
          ) : error ? (
            <p className="font-body text-sm text-danger">{error}</p>
          ) : restaurants.length === 0 ? (
            <p className="font-body text-sm text-muted">No restaurants found.</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {restaurants.map((restaurant) => (
                <Link
                  key={restaurant.id}
                  to={`/restaurants/${restaurant.id}`}
                  className="rounded-2xl bg-white p-6 shadow-elevation-low transition-shadow hover:shadow-elevation-high"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-[18px] font-medium text-charcoal">
                        {restaurant.name}
                      </h2>
                      <p className="mt-1 font-body text-sm text-muted">
                        {restaurant.cuisine ?? 'Cuisine not listed'}
                      </p>
                    </div>
                    <OpenBadge isOpen={restaurant.isOpen} />
                  </div>
                  <p className="mt-4 font-body text-xs text-muted">{restaurant.address}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
