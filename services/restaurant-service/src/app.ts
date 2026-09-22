import express from 'express';
import restaurantsRouter from './routes/restaurants';

// CI trigger check: restaurant-service workflow (re-run)
export const app = express();

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'restaurant-service' }));

// Browsing restaurants and menus is public; no auth required on these routes.
app.use(restaurantsRouter);
