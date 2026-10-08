import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useRestaurant } from '../context/RestaurantContext';
import AppNav from './AppNav';

/**
 * Layout for every page that works on the current restaurant. Owners who
 * don't have one yet are sent to register it first.
 */
export default function Page({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  const { restaurant, isLoading, error } = useRestaurant();

  if (!isLoading && !error && !restaurant) {
    return <Navigate to="/restaurants/new" replace />;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <AppNav />
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-[28px] font-semibold text-charcoal">{title}</h1>
          {actions}
        </div>
        <div className="mt-6">
          {isLoading ? (
            <div className="h-40 animate-pulse rounded-2xl bg-panel shadow-elevation-low" />
          ) : error ? (
            <p role="alert" className="font-body text-sm text-danger">
              {error}
            </p>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
