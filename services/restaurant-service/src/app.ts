import express from 'express';

// CI trigger check: restaurant-service workflow
export const app = express();

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'restaurant-service' }));
