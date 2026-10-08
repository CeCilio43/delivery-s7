import express from 'express';
import restaurantsRouter from './routes/restaurants';
import cartRouter from './routes/cart';

// CI trigger check: restaurant-service workflow (re-run)
export const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'restaurant-service' }));

// Browsing restaurants and menus is public; no auth required on these routes.
app.use(restaurantsRouter);
app.use(cartRouter);
