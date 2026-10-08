import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';

export interface TokenPayload {
  sub: string;
  role: Role;
  // Lets the customer-app show who is logged in without an extra request.
  email: string;
}

interface SignableUser {
  id: string;
  role: Role;
  email: string;
}

export function signToken(user: SignableUser): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }

  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, secret, { expiresIn: '1h' });
}

export function verifyToken(token: string): TokenPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }

  return jwt.verify(token, secret) as TokenPayload;
}
