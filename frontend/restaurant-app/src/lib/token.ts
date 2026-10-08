import { jwtDecode } from 'jwt-decode';

export const AUTH_TOKEN_KEY = 'restaurant_auth_token';

export type Role = 'CUSTOMER' | 'RESTAURANT_OWNER' | 'COURIER' | 'ADMIN';

/** The only role allowed into this app. */
export const OWNER_ROLE: Role = 'RESTAURANT_OWNER';

export interface TokenPayload {
  sub: string;
  role: Role;
  // Optional: tokens issued before user-service added it don't carry it.
  email?: string;
  iat: number;
  exp: number;
}

/** The token's claims, or null when it's malformed or expired. */
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

export interface AuthUser {
  id: string;
  role: Role;
  email: string | null;
}

// Only restaurant owners count as signed in here; any other valid token
// (e.g. a customer's) is treated as no session at all.
export function userFromToken(token: string | null): AuthUser | null {
  if (!token) return null;
  const payload = decodeToken(token);
  if (!payload || payload.role !== OWNER_ROLE) return null;
  return { id: payload.sub, role: payload.role, email: payload.email ?? null };
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}
