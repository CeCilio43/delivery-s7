import { useState } from 'react';
import { updateRestaurant } from '../api/restaurants';
import { useRestaurant } from '../context/RestaurantContext';
import { apiErrorMessage } from '../lib/format';

/**
 * Opens or closes the current restaurant for new orders. Closing doesn't
 * affect orders already placed; customers just can't place new ones.
 */
export default function OpenToggle() {
  const { restaurant, replace } = useRestaurant();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  if (!restaurant) return null;

  async function toggle() {
    if (!restaurant) return;
    setIsSaving(true);
    setError('');
    try {
      replace(await updateRestaurant(restaurant.id, { isOpen: !restaurant.isOpen }));
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not change opening status.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={restaurant.isOpen}
        aria-label={restaurant.isOpen ? 'Open for orders' : 'Closed for orders'}
        onClick={toggle}
        disabled={isSaving}
        title={restaurant.isOpen ? 'Click to stop taking new orders' : 'Click to start taking orders'}
        className={`flex items-center gap-2 rounded-2xl px-3 py-1.5 font-body text-xs font-medium transition-colors disabled:opacity-60 ${
          restaurant.isOpen
            ? 'bg-success/15 text-success hover:bg-success/25'
            : 'bg-panel text-muted shadow-elevation-low hover:text-charcoal'
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${restaurant.isOpen ? 'bg-success' : 'bg-muted'}`}
          aria-hidden="true"
        />
        {restaurant.isOpen ? 'Open' : 'Closed'}
      </button>
      {error && (
        <span role="alert" className="font-body text-xs text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
