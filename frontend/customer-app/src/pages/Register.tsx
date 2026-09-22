import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import AuthCard from '../components/AuthCard';
import Button from '../components/Button';
import TextField from '../components/TextField';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RegisterResponse {
  token: string;
}

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): boolean {
    let valid = true;
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');

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

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      valid = false;
    } else if (password && confirmPassword !== password) {
      setConfirmPasswordError('Passwords do not match');
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
      const { data } = await apiClient.post<RegisterResponse>('/register', { email, password });
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

  return (
    <AuthCard
      title="Create your account"
      subtitle="Sign up to start ordering"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand hover:text-brand-dark">
            Sign in
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
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={passwordError}
        />
        <TextField
          label="Confirm password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={confirmPasswordError}
        />
        {formError && <p className="font-body text-sm text-danger">{formError}</p>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthCard>
  );
}
