import request from 'supertest';
import { prisma } from '../prisma';
import { publishEvent } from '../events/eventBus';
import { app } from '../app';

jest.mock('../prisma', () => ({
  prisma: {
    restaurant: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    menuItem: {
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));
jest.mock('../events/eventBus', () => ({ publishEvent: jest.fn(), subscribeToEvent: jest.fn() }));

const restaurantMock = prisma.restaurant as unknown as Record<string, jest.Mock>;
const menuItemMock = prisma.menuItem as unknown as Record<string, jest.Mock>;
const mockedPublish = publishEvent as jest.Mock;

const OWNER_ID = 'owner-1';
const asOwner = (req: request.Test) =>
  req.set('x-user-id', OWNER_ID).set('x-user-role', 'RESTAURANT_OWNER');

const restaurant = {
  id: 'restaurant-1',
  ownerId: OWNER_ID,
  name: "Mario's Pizzeria",
  address: '12 Market Street',
  cuisine: 'Italian',
  description: null,
  isOpen: true,
  menuItems: [],
};

beforeEach(() => {
  jest.resetAllMocks();
});

describe('owner access', () => {
  it('rejects requests that did not come through the gateway', async () => {
    const res = await request(app).get('/owner/restaurants');
    expect(res.status).toBe(401);
  });

  it('rejects customers', async () => {
    const res = await request(app)
      .get('/owner/restaurants')
      .set('x-user-id', 'customer-1')
      .set('x-user-role', 'CUSTOMER');
    expect(res.status).toBe(403);
  });

  it("returns 404 for someone else's restaurant", async () => {
    restaurantMock.findFirst!.mockResolvedValueOnce(null);

    const res = await asOwner(request(app).patch('/owner/restaurants/restaurant-9').send({ isOpen: false }));

    expect(res.status).toBe(404);
    expect(restaurantMock.findFirst).toHaveBeenCalledWith({ where: { id: 'restaurant-9', ownerId: OWNER_ID } });
    expect(restaurantMock.update).not.toHaveBeenCalled();
  });
});

describe('GET /owner/restaurants', () => {
  it("lists only the caller's restaurants", async () => {
    restaurantMock.findMany!.mockResolvedValueOnce([restaurant]);

    const res = await asOwner(request(app).get('/owner/restaurants'));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(restaurantMock.findMany!.mock.calls[0][0].where).toEqual({ ownerId: OWNER_ID });
  });
});

describe('POST /owner/restaurants', () => {
  it('creates a closed restaurant for the caller and publishes restaurant.created', async () => {
    restaurantMock.create!.mockImplementationOnce(async ({ data }) => ({ id: 'restaurant-2', menuItems: [], ...data }));

    const res = await asOwner(
      request(app).post('/owner/restaurants').send({ name: ' Pasta Corner ', address: '3 Canal Road' }),
    );

    expect(res.status).toBe(201);
    expect(restaurantMock.create!.mock.calls[0][0].data).toEqual({
      name: 'Pasta Corner',
      address: '3 Canal Road',
      cuisine: null,
      description: null,
      ownerId: OWNER_ID,
      isOpen: false,
    });
    expect(mockedPublish).toHaveBeenCalledWith(
      'restaurant.created',
      expect.objectContaining({ restaurantId: 'restaurant-2', ownerId: OWNER_ID, isOpen: false }),
    );
  });

  it('requires a name and address', async () => {
    const res = await asOwner(request(app).post('/owner/restaurants').send({ name: 'Pasta Corner' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('address is required');
  });
});

describe('PATCH /owner/restaurants/:id', () => {
  it('closes the restaurant and publishes restaurant.updated', async () => {
    restaurantMock.findFirst!.mockResolvedValueOnce(restaurant);
    restaurantMock.update!.mockResolvedValueOnce({ ...restaurant, isOpen: false });

    const res = await asOwner(request(app).patch('/owner/restaurants/restaurant-1').send({ isOpen: false }));

    expect(res.status).toBe(200);
    expect(restaurantMock.update!.mock.calls[0][0].data).toEqual({ isOpen: false });
    expect(mockedPublish).toHaveBeenCalledWith(
      'restaurant.updated',
      expect.objectContaining({ restaurantId: 'restaurant-1', isOpen: false }),
    );
  });

  it('still succeeds when the event bus is down', async () => {
    restaurantMock.findFirst!.mockResolvedValueOnce(restaurant);
    restaurantMock.update!.mockResolvedValueOnce(restaurant);
    mockedPublish.mockRejectedValueOnce(new Error('connection refused'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await asOwner(request(app).patch('/owner/restaurants/restaurant-1').send({ name: 'Mario’s' }));

    expect(res.status).toBe(200);
  });

  it('rejects an empty update', async () => {
    const res = await asOwner(request(app).patch('/owner/restaurants/restaurant-1').send({}));
    expect(res.status).toBe(400);
  });
});

describe('menu items', () => {
  it('adds a menu item with an exact decimal price', async () => {
    restaurantMock.findFirst!.mockResolvedValueOnce(restaurant);
    menuItemMock.create!.mockImplementationOnce(async ({ data }) => ({ id: 'item-9', ...data }));

    const res = await asOwner(
      request(app)
        .post('/owner/restaurants/restaurant-1/menu-items')
        .send({ name: 'Calzone', price: 13.5 }),
    );

    expect(res.status).toBe(201);
    expect(menuItemMock.create!.mock.calls[0][0].data).toEqual({
      name: 'Calzone',
      description: null,
      price: '13.50',
      isAvailable: true,
      restaurantId: 'restaurant-1',
    });
  });

  it.each([0, -1, 'abc', 12.345])('rejects price %p', async (price) => {
    const res = await asOwner(
      request(app).post('/owner/restaurants/restaurant-1/menu-items').send({ name: 'Calzone', price }),
    );
    expect(res.status).toBe(400);
  });

  it('marks a menu item unavailable', async () => {
    restaurantMock.findFirst!.mockResolvedValueOnce(restaurant);
    menuItemMock.updateMany!.mockResolvedValueOnce({ count: 1 });
    menuItemMock.findUnique!.mockResolvedValueOnce({ id: 'item-1', isAvailable: false });

    const res = await asOwner(
      request(app).patch('/owner/restaurants/restaurant-1/menu-items/item-1').send({ isAvailable: false }),
    );

    expect(res.status).toBe(200);
    expect(menuItemMock.updateMany).toHaveBeenCalledWith({
      where: { id: 'item-1', restaurantId: 'restaurant-1' },
      data: { isAvailable: false },
    });
  });

  it("returns 404 for a menu item of another restaurant", async () => {
    restaurantMock.findFirst!.mockResolvedValueOnce(restaurant);
    menuItemMock.deleteMany!.mockResolvedValueOnce({ count: 0 });

    const res = await asOwner(request(app).delete('/owner/restaurants/restaurant-1/menu-items/item-9'));

    expect(res.status).toBe(404);
  });

  it('deletes a menu item', async () => {
    restaurantMock.findFirst!.mockResolvedValueOnce(restaurant);
    menuItemMock.deleteMany!.mockResolvedValueOnce({ count: 1 });

    const res = await asOwner(request(app).delete('/owner/restaurants/restaurant-1/menu-items/item-1'));

    expect(res.status).toBe(204);
  });
});
