import { isAxiosError } from 'axios';

export function formatPrice(value: string | number): string {
  return Number(value).toFixed(2);
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** "1 item", "3 items". */
export function itemCount(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

/** Short, readable order reference for the kitchen, e.g. "#3f9a1c". */
export function orderRef(id: string): string {
  return `#${id.slice(0, 6)}`;
}

/** The backend's `{ error }` message when there is one, else `fallback`. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const message = (err.response?.data as { error?: unknown } | undefined)?.error;
    if (typeof message === 'string') return message;
  }
  return fallback;
}
