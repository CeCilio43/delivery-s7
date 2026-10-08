import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getMyRestaurants, type Restaurant } from '../api/restaurants';
import { useAuth } from './AuthContext';

interface RestaurantContextValue {
  /** All restaurants the signed-in owner owns. */
  restaurants: Restaurant[];
  /** The one the owner is currently working on. */
  restaurant: Restaurant | null;
  isLoading: boolean;
  error: string;
  select: (id: string) => void;
  /** Swaps in a restaurant returned by an update, without refetching. */
  replace: (restaurant: Restaurant) => void;
  /** Applies a local change to one restaurant, always on its latest state. */
  patch: (id: string, change: (restaurant: Restaurant) => Restaurant) => void;
  refresh: () => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextValue | undefined>(undefined);

const SELECTED_KEY = 'restaurant_selected_id';

function readSelected(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

function writeSelected(id: string) {
  try {
    localStorage.setItem(SELECTED_KEY, id);
  } catch {
    // Only a convenience: without storage the first restaurant is picked.
  }
}

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => readSelected());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(
    () =>
      getMyRestaurants()
        .then((data) => {
          setRestaurants(data);
          setError('');
        })
        .catch(() => setError('Something went wrong loading your restaurants.'))
        .finally(() => setIsLoading(false)),
    [],
  );

  // Reload whenever a (different) owner signs in.
  const userId = user?.id;
  useEffect(() => {
    if (!isAuthenticated) return;
    refresh();
  }, [isAuthenticated, userId, refresh]);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    writeSelected(id);
  }, []);

  const replace = useCallback((updated: Restaurant) => {
    setRestaurants((current) => {
      const exists = current.some((r) => r.id === updated.id);
      return exists ? current.map((r) => (r.id === updated.id ? updated : r)) : [...current, updated];
    });
  }, []);

  const patch = useCallback((id: string, change: (restaurant: Restaurant) => Restaurant) => {
    setRestaurants((current) => current.map((r) => (r.id === id ? change(r) : r)));
  }, []);

  const value = useMemo<RestaurantContextValue>(() => {
    // Fall back to the first restaurant if nothing (valid) was selected.
    const restaurant =
      restaurants.find((r) => r.id === selectedId) ?? restaurants[0] ?? null;
    return { restaurants, restaurant, isLoading, error, select, replace, patch, refresh };
  }, [restaurants, selectedId, isLoading, error, select, replace, patch, refresh]);

  return <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>;
}

export function useRestaurant(): RestaurantContextValue {
  const context = useContext(RestaurantContext);
  if (!context) {
    throw new Error('useRestaurant must be used within a RestaurantProvider');
  }
  return context;
}
