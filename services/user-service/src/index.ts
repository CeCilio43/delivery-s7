import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'user-service' }));

app.listen(PORT, () => console.log(`user-service listening on ${PORT}`));
