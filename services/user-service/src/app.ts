import express from 'express';
import passport from './auth/passport';
import authRouter from './routes/auth';

export const app = express();

app.use(express.json());
app.use(passport.initialize());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'user-service' }));

app.use(authRouter);
