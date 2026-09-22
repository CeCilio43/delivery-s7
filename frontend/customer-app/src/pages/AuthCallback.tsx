import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Google sign-in failed: no token was returned.');
      return;
    }
    login(token);
    navigate('/home', { replace: true });
  }, [searchParams, login, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-divider px-4 text-center">
        <p className="font-body text-sm text-danger">{error}</p>
        <a href="/login" className="font-body text-sm text-brand hover:text-brand-dark">
          Back to sign in
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-divider">
      <p className="font-body text-sm text-muted">Signing you in…</p>
    </div>
  );
}
