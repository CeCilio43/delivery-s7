import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { apiClient, API_GATEWAY_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import AuthCard from '../components/AuthCard';
import Button from '../components/Button';
import TextField from '../components/TextField';
import GoogleIcon from '../components/icons/GoogleIcon';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LoginResponse {
  token: string;
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
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
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
      login(data.token);
      navigate('/home');
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

  function handleGoogleSignIn() {
    window.location.href = `${API_GATEWAY_URL}/auth/google`;
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to continue ordering"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-brand hover:text-brand-dark">
            Create one
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
        {formError && <p className="font-body text-sm text-danger">{formError}</p>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <Button
        type="button"
        variant="secondary"
        onClick={handleGoogleSignIn}
        className="flex items-center justify-center gap-3"
      >
        <GoogleIcon className="h-5 w-5" />
        Sign in with Google
      </Button>
    </AuthCard>
  );
}
