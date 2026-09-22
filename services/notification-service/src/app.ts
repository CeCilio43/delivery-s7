import express from 'express';

// CI trigger check: notification-service workflow
export const app = express();

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notification-service' }));
