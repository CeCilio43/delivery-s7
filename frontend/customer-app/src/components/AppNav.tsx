import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-2xl px-4 py-2 font-display text-[15px] font-medium transition-colors ${
    isActive ? 'bg-white text-charcoal shadow-elevation-low' : 'text-muted hover:text-charcoal'
  }`;

export default function AppNav() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <nav className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-1">
        <NavLink to="/home" className={linkClass}>
          Restaurants
        </NavLink>
        <NavLink to="/orders" className={linkClass}>
          My orders
        </NavLink>
        <NavLink to="/cart" className={linkClass}>
          Cart
          {itemCount > 0 && (
            <span className="ml-2 rounded-2xl bg-brand px-2 py-0.5 font-body text-xs text-white">
              {itemCount}
            </span>
          )}
        </NavLink>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        {user?.email && (
          <span
            className="truncate rounded-2xl bg-white px-4 py-2 font-body text-sm text-charcoal shadow-elevation-low"
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
    </nav>
  );
}
