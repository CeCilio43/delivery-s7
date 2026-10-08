import express from 'express';
import paymentsRouter from './routes/payments';

// CI trigger check: payment-service workflow (re-run)
export const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'payment-service' }));

app.use(paymentsRouter);
