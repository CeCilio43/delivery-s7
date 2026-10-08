import { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

// The api-gateway verifies the JWT and forwards the caller's id as
// x-user-id (stripping any client-supplied value first), so this service
// trusts that header rather than re-verifying the token itself.
export function requireUser(req: Request, res: Response, next: NextFunction) {
  const userId = req.header('x-user-id');
  if (!userId) {
    return res.status(401).json({ error: 'Missing x-user-id; call this service through the api-gateway' });
  }
  req.userId = userId;
  return next();
}
