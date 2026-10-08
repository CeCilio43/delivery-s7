import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRestaurant } from '../context/RestaurantContext';
import OpenToggle from './OpenToggle';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-2xl px-4 py-2 font-display text-[15px] font-medium transition-colors ${
    isActive ? 'bg-panel text-charcoal shadow-elevation-low' : 'text-muted hover:text-charcoal'
  }`;

export default function AppNav() {
  const { user, logout } = useAuth();
  const { restaurants, restaurant, select } = useRestaurant();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <nav className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span className="rounded-2xl bg-brand-tint px-3 py-1 font-body text-xs font-medium text-brand">
            Restaurant
          </span>
          {restaurants.length > 1 ? (
            <select
              aria-label="Restaurant"
              value={restaurant?.id ?? ''}
              onChange={(event) => select(event.target.value)}
              className="max-w-[16rem] truncate rounded-2xl border border-divider bg-panel px-3 py-1.5 font-display text-[15px] font-medium text-charcoal outline-none focus:border-brand"
            >
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          ) : (
            restaurant && (
              <span className="truncate font-display text-[15px] font-semibold text-charcoal">
                {restaurant.name}
              </span>
            )
          )}
          <OpenToggle />
        </div>
        <div className="flex min-w-0 items-center gap-2">
          {user?.email && (
            <span
              className="truncate rounded-2xl bg-panel px-4 py-2 font-body text-sm text-charcoal shadow-elevation-low"
              title={`Logged in as ${user.email}`}
            >
              {user.email}
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="shrink-0 rounded-2xl px-4 py-2 font-display text-[15px] font-medium text-muted transition-colors hover:text-charcoal"
          >
            Log out
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <NavLink to="/orders" className={linkClass}>
          Orders
        </NavLink>
        <NavLink to="/menu" className={linkClass}>
          Menu
        </NavLink>
        <NavLink to="/restaurant" className={linkClass}>
          Restaurant
        </NavLink>
        <Link
          to="/restaurants/new"
          className="ml-auto rounded-2xl px-4 py-2 font-body text-sm text-brand hover:text-brand-dark"
        >
          + Add restaurant
        </Link>
      </div>
    </nav>
  );
}
