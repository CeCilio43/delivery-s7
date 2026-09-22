import request from 'supertest';
import { prisma } from '../prisma';
import { app } from '../app';

jest.mock('../prisma', () => ({
  prisma: {
    restaurant: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

const mockedFindMany = prisma.restaurant.findMany as jest.Mock;
const mockedFindUnique = prisma.restaurant.findUnique as jest.Mock;

beforeEach(() => {
  mockedFindMany.mockReset();
  mockedFindUnique.mockReset();
});

describe('GET /restaurants', () => {
  it('returns 200 with the restaurant list', async () => {
    mockedFindMany.mockResolvedValueOnce([
      {
        id: 'restaurant-1',
        name: "Mario's Pizzeria",
        cuisine: 'Italian',
        address: '12 Market Street',
        isOpen: true,
      },
    ]);

    const res = await request(app).get('/restaurants');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: 'restaurant-1',
        name: "Mario's Pizzeria",
        cuisine: 'Italian',
        address: '12 Market Street',
        isOpen: true,
      },
    ]);
    expect(mockedFindMany).toHaveBeenCalledTimes(1);
    const callArgs = mockedFindMany.mock.calls[0][0];
    expect(callArgs.where).toBeUndefined();
  });

  it('filters by the search query param', async () => {
    mockedFindMany.mockResolvedValueOnce([]);

    const res = await request(app).get('/restaurants').query({ search: 'pizza' });

    expect(res.status).toBe(200);
    expect(mockedFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: 'pizza', mode: 'insensitive' } },
            { cuisine: { contains: 'pizza', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });
});

describe('GET /restaurants/:id', () => {
  it('returns 200 with the restaurant and its menu items', async () => {
    mockedFindUnique.mockResolvedValueOnce({
      id: 'restaurant-1',
      name: "Mario's Pizzeria",
      cuisine: 'Italian',
      address: '12 Market Street',
      isOpen: true,
      menuItems: [{ id: 'item-1', name: 'Margherita Pizza', price: '12.50' }],
    });

    const res = await request(app).get('/restaurants/restaurant-1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('restaurant-1');
    expect(res.body.menuItems).toEqual([
      { id: 'item-1', name: 'Margherita Pizza', price: '12.50' },
    ]);
  });

  it('returns 404 for an unknown id', async () => {
    mockedFindUnique.mockResolvedValueOnce(null);

    const res = await request(app).get('/restaurants/unknown-id');

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual(expect.any(String));
  });
});
