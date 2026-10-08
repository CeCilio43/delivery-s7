import { Router } from 'express';
import { prisma } from '../prisma';
import { requireUser } from '../middleware/requireUser';

// Read-only: payments are created by the order.created event handler, never
// directly by a client.
const router = Router();
router.use('/payments', requireUser);

router.get('/payments', async (req, res) => {
  const orderId = typeof req.query.orderId === 'string' ? req.query.orderId : undefined;

  const payments = await prisma.transaction.findMany({
    where: { customerId: req.userId!, ...(orderId ? { orderId } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(payments);
});

router.get('/payments/:id', async (req, res) => {
  const payment = await prisma.transaction.findFirst({
    where: { id: req.params.id, customerId: req.userId! },
  });

  if (!payment) {
    return res.status(404).json({ error: 'Payment not found' });
  }
  return res.json(payment);
});

export default router;
