import { Router } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../prisma';
import passport from '../auth/passport';
import { hashPassword, comparePassword } from '../auth/password';
import { signToken } from '../auth/jwt';

const router = Router();

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'A user with that email already exists' });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, role: Role.CUSTOMER },
  });

  const token = signToken(user);
  return res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

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
    const user = req.user as unknown as { id: string; role: Role };
    const token = signToken(user);
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  },
);

export default router;
