import { isAxiosError } from 'axios';

export function formatPrice(value: string | number): string {
  return Number(value).toFixed(2);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** The backend's `{ error }` message when there is one, else `fallback`. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const message = (err.response?.data as { error?: unknown } | undefined)?.error;
    if (typeof message === 'string') return message;
  }
  return fallback;
}
