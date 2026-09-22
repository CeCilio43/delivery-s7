import request from 'supertest';
import { Role } from '@prisma/client';
import { hashPassword } from '../auth/password';
import { prisma } from '../prisma';
import { app } from '../app';

jest.mock('../prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

const mockedFindUnique = prisma.user.findUnique as jest.Mock;
const mockedCreate = prisma.user.create as jest.Mock;

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

beforeEach(() => {
  mockedFindUnique.mockReset();
  mockedCreate.mockReset();
});

describe('POST /register', () => {
  it('creates a user and returns a token', async () => {
    mockedFindUnique.mockResolvedValueOnce(null);
    mockedCreate.mockResolvedValueOnce({
      id: 'user-1',
      email: 'new@example.com',
      name: 'New User',
      role: Role.CUSTOMER,
      passwordHash: 'hashed-value',
    });

    const res = await request(app)
      .post('/register')
      .send({ email: 'new@example.com', password: 'secret123', name: 'New User' });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      id: 'user-1',
      email: 'new@example.com',
      name: 'New User',
      role: Role.CUSTOMER,
    });
  });

  it('returns an error for a duplicate email', async () => {
    mockedFindUnique.mockResolvedValueOnce({ id: 'existing-1', email: 'dup@example.com' });

    const res = await request(app)
      .post('/register')
      .send({ email: 'dup@example.com', password: 'secret123', name: 'Dup' });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual(expect.any(String));
    expect(mockedCreate).not.toHaveBeenCalled();
  });
});

describe('POST /login', () => {
  it('returns a token for correct credentials', async () => {
    const passwordHash = await hashPassword('correct-password');
    mockedFindUnique.mockResolvedValueOnce({
      id: 'user-2',
      email: 'login@example.com',
      name: 'Login User',
      role: Role.CUSTOMER,
      passwordHash,
    });

    const res = await request(app)
      .post('/login')
      .send({ email: 'login@example.com', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      id: 'user-2',
      email: 'login@example.com',
      name: 'Login User',
      role: Role.CUSTOMER,
    });
  });

  it('returns 401 for the wrong password', async () => {
    const passwordHash = await hashPassword('correct-password');
    mockedFindUnique.mockResolvedValueOnce({
      id: 'user-3',
      email: 'wrongpass@example.com',
      name: 'Wrong Pass',
      role: Role.CUSTOMER,
      passwordHash,
    });

    const res = await request(app)
      .post('/login')
      .send({ email: 'wrongpass@example.com', password: 'incorrect-password' });

    expect(res.status).toBe(401);
  });

  it('returns a clear 400 error for a Google-only account', async () => {
    mockedFindUnique.mockResolvedValueOnce({
      id: 'user-4',
      email: 'google@example.com',
      name: 'Google User',
      role: Role.CUSTOMER,
      passwordHash: null,
      googleId: 'google-sub-123',
    });

    const res = await request(app)
      .post('/login')
      .send({ email: 'google@example.com', password: 'whatever' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/google/i);
  });
});
