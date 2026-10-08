import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { AuthProvider } from './AuthContext';
import { CartProvider, useCart } from './CartContext';
import { CUSTOMER_ID, signInAsCustomer } from '../test/utils';

const marios = { id: 'restaurant-1', name: "Mario's Pizzeria" };
const spiceRoute = { id: 'restaurant-2', name: 'Spice Route' };
const pizza = { menuItemId: 'item-1', name: 'Margherita Pizza', price: '12.50' };
const bread = { menuItemId: 'item-2', name: 'Garlic Bread', price: '4.50' };
const curry = { menuItemId: 'item-4', name: 'Chicken Tikka Masala', price: '13.00' };

function renderCart() {
  signInAsCustomer();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>
      <CartProvider>{children}</CartProvider>
    </AuthProvider>
  );
  return renderHook(() => useCart(), { wrapper });
}

describe('CartContext', () => {
  it('adds items, counting repeats as quantity', () => {
    const { result } = renderCart();

    act(() => {
      result.current.addItem(marios, pizza);
    });
    act(() => {
      result.current.addItem(marios, pizza);
    });
    act(() => {
      result.current.addItem(marios, bread);
    });

    expect(result.current.cart?.items).toEqual([
      { ...pizza, quantity: 2 },
      { ...bread, quantity: 1 },
    ]);
    expect(result.current.itemCount).toBe(3);
    expect(result.current.total).toBe(29.5);
  });

  it('starts a new cart when adding from another restaurant', () => {
    const { result } = renderCart();

    act(() => {
      result.current.addItem(marios, pizza);
    });
    let replaced = false;
    act(() => {
      replaced = result.current.addItem(spiceRoute, curry);
    });

    expect(replaced).toBe(true);
    expect(result.current.cart).toEqual({
      restaurantId: 'restaurant-2',
      restaurantName: 'Spice Route',
      items: [{ ...curry, quantity: 1 }],
    });
  });

  it('removes an item at quantity 0 and empties the cart with its last item', () => {
    const { result } = renderCart();

    act(() => {
      result.current.addItem(marios, pizza);
    });
    act(() => {
      result.current.setQuantity('item-1', 0);
    });

    expect(result.current.cart).toBeNull();
    expect(localStorage.getItem(`cart:${CUSTOMER_ID}`)).toBeNull();
  });

  it("persists the cart under the user's own key", () => {
    const { result } = renderCart();

    act(() => {
      result.current.addItem(marios, pizza);
    });

    expect(JSON.parse(localStorage.getItem(`cart:${CUSTOMER_ID}`)!)).toMatchObject({
      restaurantId: 'restaurant-1',
      items: [{ menuItemId: 'item-1', quantity: 1 }],
    });
  });
});
