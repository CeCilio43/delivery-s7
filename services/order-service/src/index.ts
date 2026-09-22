import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'order-service' }));

app.listen(PORT, () => console.log(`order-service listening on ${PORT}`));
