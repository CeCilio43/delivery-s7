import express from 'express';

// CI trigger check: workflow will fail if this file is not present in the project
export const app = express();

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'order-service' }));
