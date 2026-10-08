import request from 'supertest';
import { prisma } from '../prisma';
import { publishEvent } from '../events/eventBus';
import { app } from '../app';

jest.mock('../prisma', () => ({
  prisma: {
    order: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
    },
    restaurantProjection: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));
jest.mock('../events/eventBus', () => ({ publishEvent: jest.fn() }));

const mockedFindMany = prisma.order.findMany as jest.Mock;
const mockedFindFirst = prisma.order.findFirst as jest.Mock;
const mockedFindUnique = prisma.order.findUniqueOrThrow as jest.Mock;
const mockedUpdateMany = prisma.order.updateMany as jest.Mock;
const mockedOwnedRestaurants = prisma.restaurantProjection.findMany as jest.Mock;
const mockedRestaurant = prisma.restaurantProjection.findUnique as jest.Mock;
const mockedPublish = publishEvent as jest.Mock;

const OWNER_ID = 'owner-1';
const asOwner = (req: request.Test) =>
  req.set('x-user-id', OWNER_ID).set('x-user-role', 'RESTAURANT_OWNER');

const order = (status: string) => ({
  id: 'order-1',
  customerId: 'customer-1',
  restaurantId: 'restaurant-1',
  status,
  confirmedAt: new Date('2026-10-08T12:00:00Z'),
  lines: [],
});

beforeEach(() => {
  jest.resetAllMocks();
  mockedOwnedRestaurants.mockResolvedValue([{ id: 'restaurant-1' }]);
  mockedRestaurant.mockResolvedValue({ id: 'restaurant-1', ownerId: OWNER_ID });
});

describe('owner access', () => {
  it('rejects requests that did not come through the gateway', async () => {
    const res = await request(app).get('/owner/orders');
    expect(res.status).toBe(401);
  });

  it('rejects customers', async () => {
    const res = await request(app)
      .get('/owner/orders')
      .set('x-user-id', 'customer-1')
      .set('x-user-role', 'CUSTOMER');
    expect(res.status).toBe(403);
  });
});

describe('GET /owner/orders', () => {
  it("lists only paid orders of the owner's restaurants", async () => {
    mockedFindMany.mockResolvedValueOnce([order('CONFIRMED')]);

    const res = await asOwner(request(app).get('/owner/orders').query({ status: 'CONFIRMED,PREPARING' }));

    expect(res.status).toBe(200);
    expect(mockedOwnedRestaurants).toHaveBeenCalledWith({ where: { ownerId: OWNER_ID }, select: { id: true } });
    expect(mockedFindMany.mock.calls[0][0].where).toEqual({
      restaurantId: { in: ['restaurant-1'] },
      confirmedAt: { not: null },
      status: { in: ['CONFIRMED', 'PREPARING'] },
    });
  });

  it('rejects unknown statuses', async () => {
    const res = await asOwner(request(app).get('/owner/orders').query({ status: 'CONFIRMED,NOPE' }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when filtering on someone else's restaurant", async () => {
    const res = await asOwner(request(app).get('/owner/orders').query({ restaurantId: 'restaurant-9' }));
    expect(res.status).toBe(404);
    expect(mockedFindMany).not.toHaveBeenCalled();
  });
});

describe('POST /owner/orders/:id/accept', () => {
  it('moves a CONFIRMED order to PREPARING and publishes order.preparing', async () => {
    mockedFindFirst.mockResolvedValueOnce(order('CONFIRMED'));
    mockedUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockedFindUnique.mockResolvedValueOnce(order('PREPARING'));

    const res = await asOwner(request(app).post('/owner/orders/order-1/accept'));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PREPARING');
    expect(mockedUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', status: { in: ['CONFIRMED'] } },
      data: { status: 'PREPARING' },
    });
    expect(mockedPublish).toHaveBeenCalledWith(
      'order.preparing',
      expect.objectContaining({ orderId: 'order-1', customerId: 'customer-1', restaurantOwnerId: OWNER_ID }),
    );
  });

  it('refuses when the order is no longer CONFIRMED', async () => {
    mockedFindFirst.mockResolvedValueOnce(order('CANCELLED'));
    mockedUpdateMany.mockResolvedValueOnce({ count: 0 });
    mockedFindUnique.mockResolvedValueOnce(order('CANCELLED'));

    const res = await asOwner(request(app).post('/owner/orders/order-1/accept'));

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Order cannot be accepted while CANCELLED');
    expect(mockedPublish).not.toHaveBeenCalled();
  });

  it("returns 404 for another restaurant's order", async () => {
    mockedFindFirst.mockResolvedValueOnce(null);

    const res = await asOwner(request(app).post('/owner/orders/order-9/accept'));

    expect(res.status).toBe(404);
    expect(mockedFindFirst.mock.calls[0][0].where).toEqual({
      id: 'order-9',
      restaurantId: { in: ['restaurant-1'] },
      confirmedAt: { not: null },
    });
    expect(mockedUpdateMany).not.toHaveBeenCalled();
  });
});

describe('POST /owner/orders/:id/ready', () => {
  it('moves a PREPARING order to READY and publishes order.ready', async () => {
    mockedFindFirst.mockResolvedValueOnce(order('PREPARING'));
    mockedUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockedFindUnique.mockResolvedValueOnce(order('READY'));

    const res = await asOwner(request(app).post('/owner/orders/order-1/ready'));

    expect(res.status).toBe(200);
    expect(mockedUpdateMany.mock.calls[0][0].where.status).toEqual({ in: ['PREPARING'] });
    expect(mockedPublish).toHaveBeenCalledWith('order.ready', expect.objectContaining({ orderId: 'order-1' }));
  });
});

describe('POST /owner/orders/:id/reject', () => {
  it('cancels the order with the reason so payment-service refunds it', async () => {
    mockedFindFirst.mockResolvedValueOnce(order('CONFIRMED'));
    mockedUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockedFindUnique.mockResolvedValueOnce(order('CANCELLED'));

    const res = await asOwner(
      request(app).post('/owner/orders/order-1/reject').send({ reason: 'Out of mozzarella' }),
    );

    expect(res.status).toBe(200);
    expect(mockedUpdateMany.mock.calls[0][0].where.status).toEqual({ in: ['CONFIRMED', 'PREPARING'] });
    expect(mockedPublish).toHaveBeenCalledWith(
      'order.cancelled',
      expect.objectContaining({ orderId: 'order-1', reason: 'Rejected by the restaurant: Out of mozzarella' }),
    );
  });

  it('rejects a reason that is too long', async () => {
    const res = await asOwner(
      request(app).post('/owner/orders/order-1/reject').send({ reason: 'x'.repeat(201) }),
    );
    expect(res.status).toBe(400);
    expect(mockedUpdateMany).not.toHaveBeenCalled();
  });
});
