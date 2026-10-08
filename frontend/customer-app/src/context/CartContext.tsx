import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';

export interface CartItem {
  menuItemId: string;
  name: string;
  // Display price only; order-service re-prices every item at checkout.
  price: string;
  quantity: number;
}

export interface Cart {
  restaurantId: string;
  restaurantName: string;
  items: CartItem[];
}

interface CartContextValue {
  cart: Cart | null;
  itemCount: number;
  total: number;
  /** Returns true when the item replaced a cart from another restaurant. */
  addItem: (restaurant: { id: string; name: string }, item: Omit<CartItem, 'quantity'>) => boolean;
  setQuantity: (menuItemId: string, quantity: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

// Kept per user so logging in as someone else doesn't inherit a cart.
function storageKey(userId: string): string {
  return `cart:${userId}`;
}

function readCart(userId: string | undefined): Cart | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as Cart) : null;
  } catch {
    return null;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [cart, setCart] = useState<Cart | null>(() => readCart(userId));

  // Swap in the right cart when the logged-in user changes. Done during
  // render (React's "adjust state on prop change" pattern) so no render
  // ever shows the previous user's cart.
  const [cartOwnerId, setCartOwnerId] = useState(userId);
  if (cartOwnerId !== userId) {
    setCartOwnerId(userId);
    setCart(readCart(userId));
  }

  const persist = useCallback(
    (next: Cart | null) => {
      setCart(next);
      if (!userId) return;
      try {
        if (next && next.items.length > 0) {
          localStorage.setItem(storageKey(userId), JSON.stringify(next));
        } else {
          localStorage.removeItem(storageKey(userId));
        }
      } catch {
        // Storage can be unavailable (e.g. private mode); the cart still
        // works for this session, it just won't survive a reload.
      }
    },
    [userId],
  );

  const addItem = useCallback<CartContextValue['addItem']>(
    (restaurant, item) => {
      // An order belongs to a single restaurant, so adding from a different
      // one starts a fresh cart.
      const replaced = cart !== null && cart.restaurantId !== restaurant.id;
      const base: Cart =
        cart && !replaced
          ? cart
          : { restaurantId: restaurant.id, restaurantName: restaurant.name, items: [] };

      const existing = base.items.find((i) => i.menuItemId === item.menuItemId);
      const items = existing
        ? base.items.map((i) =>
            i.menuItemId === item.menuItemId ? { ...i, quantity: i.quantity + 1 } : i,
          )
        : [...base.items, { ...item, quantity: 1 }];

      persist({ ...base, items });
      return replaced;
    },
    [cart, persist],
  );

  const setQuantity = useCallback(
    (menuItemId: string, quantity: number) => {
      if (!cart) return;
      const items =
        quantity <= 0
          ? cart.items.filter((i) => i.menuItemId !== menuItemId)
          : cart.items.map((i) => (i.menuItemId === menuItemId ? { ...i, quantity } : i));
      persist(items.length > 0 ? { ...cart, items } : null);
    },
    [cart, persist],
  );

  const clear = useCallback(() => persist(null), [persist]);

  const value = useMemo<CartContextValue>(() => {
    const items = cart?.items ?? [];
    return {
      cart,
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      total: items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0),
      addItem,
      setQuantity,
      clear,
    };
  }, [cart, addItem, setQuantity, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
