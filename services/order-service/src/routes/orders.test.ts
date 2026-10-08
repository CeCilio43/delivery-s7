import request from 'supertest';
import { prisma } from '../prisma';
import { publishEvent } from '../events/eventBus';
import { app } from '../app';

jest.mock('../prisma', () => ({
  prisma: {
    order: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    restaurantProjection: {
      findUnique: jest.fn(),
    },
  },
}));
jest.mock('../events/eventBus', () => ({ publishEvent: jest.fn() }));

const mockedCreate = prisma.order.create as jest.Mock;
const mockedUpdate = prisma.order.update as jest.Mock;
const mockedUpdateMany = prisma.order.updateMany as jest.Mock;
const mockedFindFirst = prisma.order.findFirst as jest.Mock;
const mockedPublish = publishEvent as jest.Mock;
const mockedFindRestaurant = prisma.restaurantProjection.findUnique as jest.Mock;
const mockedFetch = jest.fn();

const USER_ID = 'customer-1';
const restaurant = {
  id: 'restaurant-1',
  isOpen: true,
  menuItems: [
    { id: 'item-1', name: 'Margherita Pizza', price: '12.50', isAvailable: true },
    { id: 'item-2', name: 'Garlic Bread', price: '4.50', isAvailable: false },
  ],
};

function respondWithRestaurant(body: unknown, status = 200) {
  mockedFetch.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body });
}

beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = mockedFetch as unknown as typeof fetch;
  mockedCreate.mockImplementation(async ({ data }) => ({
    id: 'order-1',
    customerId: data.customerId,
    restaurantId: data.restaurantId,
    status: 'PLACED',
    totalAmount: data.totalAmount,
    createdAt: new Date('2026-10-08T12:00:00Z'),
    lines: data.lines.create,
  }));
});

describe('POST /orders', () => {
  it('rejects requests that did not come through the gateway', async () => {
    const res = await request(app).post('/orders').send({});
    expect(res.status).toBe(401);
  });

  it('prices the order from restaurant-service and publishes order.created', async () => {
    respondWithRestaurant(restaurant);

    const res = await request(app)
      .post('/orders')
      .set('x-user-id', USER_ID)
      // A client-supplied price must be ignored.
      .send({ restaurantId: 'restaurant-1', items: [{ menuItemId: 'item-1', quantity: 2, price: 0.01 }] });

    expect(res.status).toBe(201);
    expect(mockedCreate.mock.calls[0][0].data.customerId).toBe(USER_ID);
    expect(mockedCreate.mock.calls[0][0].data.totalAmount.toString()).toBe('25');
    expect(mockedPublish).toHaveBeenCalledWith(
      'order.created',
      expect.objectContaining({
        orderId: 'order-1',
        customerId: USER_ID,
        total: 25,
        items: [{ menuItemId: 'item-1', quantity: 2, price: 12.5 }],
      }),
    );
  });

  it('rejects unavailable menu items', async () => {
    respondWithRestaurant(restaurant);

    const res = await request(app)
      .post('/orders')
      .set('x-user-id', USER_ID)
      .send({ restaurantId: 'restaurant-1', items: [{ menuItemId: 'item-2', quantity: 1 }] });

    expect(res.status).toBe(422);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('rejects orders at a closed restaurant', async () => {
    respondWithRestaurant({ ...restaurant, isOpen: false });

    const res = await request(app)
      .post('/orders')
      .set('x-user-id', USER_ID)
      .send({ restaurantId: 'restaurant-1', items: [{ menuItemId: 'item-1', quantity: 1 }] });

    expect(res.status).toBe(409);
  });

  it('returns 404 for an unknown restaurant', async () => {
    respondWithRestaurant({ error: 'Restaurant not found' }, 404);

    const res = await request(app)
      .post('/orders')
      .set('x-user-id', USER_ID)
      .send({ restaurantId: 'nope', items: [{ menuItemId: 'item-1', quantity: 1 }] });

    expect(res.status).toBe(404);
  });

  it('validates quantities', async () => {
    const res = await request(app)
      .post('/orders')
      .set('x-user-id', USER_ID)
      .send({ restaurantId: 'restaurant-1', items: [{ menuItemId: 'item-1', quantity: 0 }] });

    expect(res.status).toBe(400);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('cancels the order when the event bus is unreachable', async () => {
    respondWithRestaurant(restaurant);
    mockedPublish.mockRejectedValueOnce(new Error('connection refused'));

    const res = await request(app)
      .post('/orders')
      .set('x-user-id', USER_ID)
      .send({ restaurantId: 'restaurant-1', items: [{ menuItemId: 'item-1', quantity: 1 }] });

    expect(res.status).toBe(503);
    expect(mockedUpdate).toHaveBeenCalledWith({ where: { id: 'order-1' }, data: { status: 'CANCELLED' } });
  });
});

describe('GET /orders/:id', () => {
  it("only looks up the caller's own orders", async () => {
    mockedFindFirst.mockResolvedValueOnce(null);

    const res = await request(app).get('/orders/order-1').set('x-user-id', USER_ID);

    expect(res.status).toBe(404);
    expect(mockedFindFirst.mock.calls[0][0].where).toEqual({ id: 'order-1', customerId: USER_ID });
  });
});

describe('POST /orders/:id/cancel', () => {
  it('cancels a PLACED order and publishes order.cancelled', async () => {
    mockedUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockedFindFirst.mockResolvedValueOnce({
      id: 'order-1',
      customerId: USER_ID,
      restaurantId: 'restaurant-1',
      status: 'CANCELLED',
      confirmedAt: new Date('2026-10-08T12:00:00Z'),
    });
    mockedFindRestaurant.mockResolvedValueOnce({ id: 'restaurant-1', ownerId: 'owner-1' });

    const res = await request(app).post('/orders/order-1/cancel').set('x-user-id', USER_ID);

    expect(res.status).toBe(200);
    expect(mockedPublish).toHaveBeenCalledWith(
      'order.cancelled',
      expect.objectContaining({
        orderId: 'order-1',
        customerId: USER_ID,
        restaurantOwnerId: 'owner-1',
        reason: 'Cancelled by customer',
      }),
    );
  });

  it('refuses to cancel an order that is past cancellation', async () => {
    mockedUpdateMany.mockResolvedValueOnce({ count: 0 });
    mockedFindFirst.mockResolvedValueOnce({ id: 'order-1', status: 'DELIVERED' });

    const res = await request(app).post('/orders/order-1/cancel').set('x-user-id', USER_ID);

    expect(res.status).toBe(409);
    expect(mockedPublish).not.toHaveBeenCalled();
  });
});
