import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { apiErrorMessage, formatPrice } from './format';

describe('formatPrice', () => {
  it('formats numbers and numeric strings with two decimals', () => {
    expect(formatPrice(12.5)).toBe('12.50');
    expect(formatPrice('4')).toBe('4.00');
  });
});

describe('apiErrorMessage', () => {
  it("uses the backend's error message", () => {
    const err = new AxiosError('Conflict', '409', undefined, undefined, {
      status: 409,
      statusText: 'Conflict',
      data: { error: 'Restaurant is currently closed' },
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    expect(apiErrorMessage(err, 'fallback')).toBe('Restaurant is currently closed');
  });

  it('falls back when there is no message', () => {
    expect(apiErrorMessage(new Error('network down'), 'fallback')).toBe('fallback');
  });
});
