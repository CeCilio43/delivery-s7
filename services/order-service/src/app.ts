import express from 'express';

// CI trigger check: order-service workflow (re-run)
export const app = express();

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'order-service' }));
