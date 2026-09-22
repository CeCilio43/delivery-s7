import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { requireAuth } from './requireAuth';

function mockReqRes(headers: Record<string, string> = {}) {
  const req = { headers } as unknown as Request;
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  } as unknown as Response & { statusCode: number; body: unknown };
  const next = jest.fn();
  return { req, res, next };
}

describe('requireAuth', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  it('rejects requests with no Authorization header', () => {
    const { req, res, next } = mockReqRes();
    requireAuth(req, res, next);
    expect((res as unknown as { statusCode: number }).statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects requests with an invalid token', () => {
    const { req, res, next } = mockReqRes({ authorization: 'Bearer not-a-real-token' });
    requireAuth(req, res, next);
    expect((res as unknown as { statusCode: number }).statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next and attaches the user for a valid token', () => {
    const token = jwt.sign({ sub: 'user-1', role: 'CUSTOMER' }, 'test-secret');
    const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(expect.objectContaining({ sub: 'user-1', role: 'CUSTOMER' }));
  });
});
