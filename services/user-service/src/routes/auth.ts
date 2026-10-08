import { Router, type Request, type Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../prisma';
import passport from '../auth/passport';
import { hashPassword, comparePassword } from '../auth/password';
import { signToken } from '../auth/jwt';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/** Creates an account with `role` and signs it straight in. */
async function register(req: Request, res: Response, role: Role) {
  const { email, password, name } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }
  if (name !== undefined && typeof name !== 'string') {
    return res.status(400).json({ error: 'name must be a string' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'A user with that email already exists' });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, name: name?.trim() || null, role },
  });

  const token = signToken(user);
  return res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}

// Customers sign up from the customer-app.
router.post('/register', (req, res) => register(req, res, Role.CUSTOMER));

// Restaurant owners sign up from the restaurant-app, then register their
// restaurant there. Only these two roles can be self-assigned; couriers and
// admins can't sign themselves up.
router.post('/register/restaurant-owner', (req, res) => register(req, res, Role.RESTAURANT_OWNER));

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!user.passwordHash) {
    return res.status(400).json({
      error: 'This account uses Google sign-in. Please log in with Google instead.',
    });
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken(user);
  return res.status(200).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

router.get(
  '/auth/google',
  passport.authenticate('google', { session: false, scope: ['profile', 'email'] }),
);

router.get(
  '/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login-failed' }),
  (req, res) => {
    const user = req.user as unknown as { id: string; role: Role; email: string };
    const token = signToken(user);
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  },
);

export default router;
