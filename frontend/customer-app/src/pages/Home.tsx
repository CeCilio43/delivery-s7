import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import type { Role } from '../lib/token';

const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: 'Customer',
  RESTAURANT_OWNER: 'Restaurant Owner',
  COURIER: 'Courier',
  ADMIN: 'Admin',
};

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-divider px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-elevation-low">
        <h1 className="font-display text-[28px] font-semibold text-charcoal">Welcome!</h1>
        <p className="mt-2 font-body text-sm text-muted">
          You&apos;re signed in as a {user ? ROLE_LABELS[user.role] : 'user'}.
        </p>
        <div className="mt-8">
          <Button variant="secondary" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </div>
    </div>
  );
}
