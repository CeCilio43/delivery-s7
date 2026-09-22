import express from 'express';

// CI trigger check: payment-service workflow (re-run)
export const app = express();

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'payment-service' }));
