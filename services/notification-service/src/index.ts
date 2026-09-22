import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notification-service' }));

app.listen(PORT, () => console.log(`notification-service listening on ${PORT}`));
