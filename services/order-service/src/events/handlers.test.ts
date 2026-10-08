import { prisma } from '../prisma';
import { publishEvent } from './eventBus';
import { handlePaymentFailed, handlePaymentSucceeded, handleRestaurantChanged } from './handlers';

jest.mock('../prisma', () => ({
  prisma: {
    order: {
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    restaurantProjection: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));
jest.mock('./eventBus', () => ({ publishEvent: jest.fn(), subscribeToEvent: jest.fn() }));

const mockedUpdateMany = prisma.order.updateMany as jest.Mock;
const mockedFindOrder = prisma.order.findUniqueOrThrow as jest.Mock;
const mockedFindRestaurant = prisma.restaurantProjection.findUnique as jest.Mock;
const mockedUpsert = prisma.restaurantProjection.upsert as jest.Mock;
const mockedPublish = publishEvent as jest.Mock;

const paidOrder = {
  id: 'order-1',
  customerId: 'customer-1',
  restaurantId: 'restaurant-1',
  confirmedAt: new Date('2026-10-08T12:00:00Z'),
};
const unpaidOrder = { ...paidOrder, confirmedAt: null };

beforeEach(() => {
  jest.resetAllMocks();
  mockedFindOrder.mockResolvedValue(paidOrder);
  mockedFindRestaurant.mockResolvedValue({ id: 'restaurant-1', ownerId: 'owner-1' });
});

describe('handlePaymentSucceeded', () => {
  const event = { paymentId: 'pay-1', orderId: 'order-1', amount: 25, succeededAt: '2026-10-08T12:00:00Z' };

  it('confirms a PLACED order and publishes order.confirmed for customer and owner', async () => {
    mockedUpdateMany.mockResolvedValueOnce({ count: 1 });

    await handlePaymentSucceeded(event);

    expect(mockedUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', status: 'PLACED' },
      data: { status: 'CONFIRMED', confirmedAt: expect.any(Date) },
    });
    expect(mockedPublish).toHaveBeenCalledWith(
      'order.confirmed',
      expect.objectContaining({
        orderId: 'order-1',
        customerId: 'customer-1',
        restaurantId: 'restaurant-1',
        restaurantOwnerId: 'owner-1',
      }),
    );
  });

  it('publishes without an owner when the restaurant is unknown', async () => {
    mockedUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockedFindRestaurant.mockResolvedValueOnce(null);
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await handlePaymentSucceeded(event);

    expect(mockedPublish).toHaveBeenCalledWith(
      'order.confirmed',
      expect.objectContaining({ restaurantOwnerId: null }),
    );
  });

  it('ignores a payment for an order that is no longer PLACED', async () => {
    mockedUpdateMany.mockResolvedValueOnce({ count: 0 });

    await handlePaymentSucceeded(event);

    expect(mockedPublish).not.toHaveBeenCalled();
  });
});

describe('handlePaymentFailed', () => {
  it('cancels a PLACED order and tells only the customer why', async () => {
    mockedUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockedFindOrder.mockResolvedValueOnce(unpaidOrder);

    await handlePaymentFailed({
      paymentId: 'pay-1',
      orderId: 'order-1',
      reason: 'Card declined',
      failedAt: '2026-10-08T12:00:00Z',
    });

    expect(mockedPublish).toHaveBeenCalledWith(
      'order.cancelled',
      expect.objectContaining({
        orderId: 'order-1',
        customerId: 'customer-1',
        // Never paid, so the restaurant never saw it and isn't told.
        restaurantOwnerId: null,
        reason: 'Payment failed: Card declined',
      }),
    );
  });
});

describe('handleRestaurantChanged', () => {
  it('upserts the local copy of the restaurant owner', async () => {
    await handleRestaurantChanged({
      restaurantId: 'restaurant-1',
      ownerId: 'owner-1',
      name: "Mario's Pizzeria",
      isOpen: true,
      changedAt: '2026-10-08T12:00:00Z',
    });

    expect(mockedUpsert).toHaveBeenCalledWith({
      where: { id: 'restaurant-1' },
      create: { id: 'restaurant-1', ownerId: 'owner-1', name: "Mario's Pizzeria" },
      update: { ownerId: 'owner-1', name: "Mario's Pizzeria" },
    });
  });
});
