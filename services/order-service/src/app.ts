import express from 'express';
import ordersRouter from './routes/orders';

// CI trigger check: order-service workflow (re-run)
export const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'order-service' }));

app.use(ordersRouter);
