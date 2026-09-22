import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';

export interface TokenPayload {
  sub: string;
  role: Role;
}

interface SignableUser {
  id: string;
  role: Role;
}

export function signToken(user: SignableUser): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }

  return jwt.sign({ sub: user.id, role: user.role }, secret, { expiresIn: '1h' });
}

export function verifyToken(token: string): TokenPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }

  return jwt.verify(token, secret) as TokenPayload;
}
