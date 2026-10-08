import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { OWNER_ROLE, type Role } from '../lib/token';
import AuthCard from '../components/AuthCard';
import Button from '../components/Button';
import TextField from '../components/TextField';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LoginResponse {
  token: string;
  user: { id: string; email: string; role: Role };
}

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): boolean {
    let valid = true;
    setEmailError('');
    setPasswordError('');

    if (!email) {
      setEmailError('Email is required');
      valid = false;
    } else if (!EMAIL_REGEX.test(email)) {
      setEmailError('Enter a valid email address');
      valid = false;
    }

    if (!password) {
      setPasswordError('Password is required');
      valid = false;
    }

    return valid;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const { data } = await apiClient.post<LoginResponse>('/login', { email, password });
      // The same accounts log in to both apps; only owners belong here.
      if (data.user.role !== OWNER_ROLE) {
        setFormError(
          "This account isn't a restaurant owner. Customers can order in the customer app.",
        );
        return;
      }
      login(data.token);
      navigate('/orders');
    } catch (err) {
      const message =
        isAxiosError(err) && typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : 'Something went wrong. Please try again.';
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Restaurant sign in"
      subtitle="Manage the orders for your restaurant"
      footer={
        <>
          New restaurant partner?{' '}
          <Link to="/register" className="font-medium text-brand hover:text-brand-dark">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError}
        />
        <TextField
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={passwordError}
        />
        {formError && (
          <p role="alert" className="font-body text-sm text-danger">
            {formError}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthCard>
  );
}
