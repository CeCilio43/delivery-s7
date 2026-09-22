import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  clearStoredToken,
  decodeToken,
  getStoredToken,
  setStoredToken,
  type Role,
} from '../lib/token';

export interface AuthUser {
  id: string;
  role: Role;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function userFromToken(token: string | null): AuthUser | null {
  if (!token) return null;
  const payload = decodeToken(token);
  return payload ? { id: payload.sub, role: payload.role } : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<AuthUser | null>(() => userFromToken(getStoredToken()));

  const login = useCallback((newToken: string) => {
    setStoredToken(newToken);
    setToken(newToken);
    setUser(userFromToken(newToken));
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, isAuthenticated: user !== null, login, logout }),
    [user, token, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
