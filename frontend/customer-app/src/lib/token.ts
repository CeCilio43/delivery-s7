import { jwtDecode } from 'jwt-decode';

export const AUTH_TOKEN_KEY = 'auth_token';

export type Role = 'CUSTOMER' | 'RESTAURANT_OWNER' | 'COURIER' | 'ADMIN';

export interface TokenPayload {
  sub: string;
  role: Role;
  iat: number;
  exp: number;
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    const payload = jwtDecode<TokenPayload>(token);
    if (payload.exp * 1000 < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}
