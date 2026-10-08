import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { apiErrorMessage } from '../lib/format';
import AuthCard from '../components/AuthCard';
import Button from '../components/Button';
import TextField from '../components/TextField';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

interface RegisterResponse {
  token: string;
}

interface FieldErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

/** Signs up a new restaurant owner, who then sets up their restaurant. */
export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!email) next.email = 'Email is required';
    else if (!EMAIL_REGEX.test(email)) next.email = 'Enter a valid email address';

    if (!password) next.password = 'Password is required';
    else if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }

    if (!confirmPassword) next.confirmPassword = 'Please confirm your password';
    else if (password && confirmPassword !== password) next.confirmPassword = 'Passwords do not match';
    return next;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const { data } = await apiClient.post<RegisterResponse>('/register/restaurant-owner', {
        email,
        password,
        ...(name.trim() ? { name: name.trim() } : {}),
      });
      login(data.token);
      // A brand-new owner has no restaurant yet; set one up first.
      navigate('/restaurants/new');
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Create a restaurant account"
      subtitle="Sign up, then add your restaurant and menu"
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
          label="Your name (optional)"
          name="name"
          autoComplete="name"
          value={name}
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <TextField
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <TextField
          label="Confirm password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={errors.confirmPassword}
        />
        {formError && (
          <p role="alert" className="font-body text-sm text-danger">
            {formError}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthCard>
  );
}
