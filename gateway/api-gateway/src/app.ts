import express from 'express';

// CI trigger check: api-gateway workflow (re-run)
export const app = express();

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'api-gateway' }));
