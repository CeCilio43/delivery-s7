import { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    ownerId?: string;
  }
}

// The api-gateway verifies the JWT and forwards the caller as x-user-id /
// x-user-role (stripping any client-supplied values first), so this service
// trusts those headers rather than re-verifying the token itself.
export function requireOwner(req: Request, res: Response, next: NextFunction) {
  const userId = req.header('x-user-id');
  if (!userId) {
    return res.status(401).json({ error: 'Missing x-user-id; call this service through the api-gateway' });
  }
  if (req.header('x-user-role') !== 'RESTAURANT_OWNER') {
    return res.status(403).json({ error: 'Only restaurant owners can do this' });
  }
  req.ownerId = userId;
  return next();
}
