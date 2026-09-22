import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedUser {
  sub: string;
  role: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'JWT_SECRET is not configured on the gateway' });
  }

  try {
    req.user = jwt.verify(token, secret) as AuthenticatedUser;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
