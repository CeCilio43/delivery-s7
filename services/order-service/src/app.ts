import express from 'express';
import ordersRouter from './routes/orders';
import ownerRouter from './routes/owner';

// CI trigger check: order-service workflow (re-run)
export const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'order-service' }));

// Customers placing and following their own orders (/orders/...).
app.use(ordersRouter);

// Restaurant owners handling their restaurants' orders (/owner/orders/...).
app.use(ownerRouter);
