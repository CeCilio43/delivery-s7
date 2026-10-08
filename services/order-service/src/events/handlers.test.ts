import { prisma } from '../prisma';
import { publishEvent } from './eventBus';
import { handlePaymentFailed, handlePaymentSucceeded } from './handlers';

jest.mock('../prisma', () => ({
  prisma: {
    order: {
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  },
}));
jest.mock('./eventBus', () => ({ publishEvent: jest.fn(), subscribeToEvent: jest.fn() }));

const mockedUpdateMany = prisma.order.updateMany as jest.Mock;
const mockedFindUnique = prisma.order.findUniqueOrThrow as jest.Mock;
const mockedPublish = publishEvent as jest.Mock;

beforeEach(() => jest.resetAllMocks());

describe('handlePaymentSucceeded', () => {
  const event = { paymentId: 'pay-1', orderId: 'order-1', amount: 25, succeededAt: '2026-10-08T12:00:00Z' };

  it('confirms a PLACED order and publishes order.confirmed', async () => {
    mockedUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockedFindUnique.mockResolvedValueOnce({
      id: 'order-1',
      customerId: 'customer-1',
      restaurantId: 'restaurant-1',
    });

    await handlePaymentSucceeded(event);

    expect(mockedUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', status: 'PLACED' },
      data: { status: 'CONFIRMED' },
    });
    expect(mockedPublish).toHaveBeenCalledWith(
      'order.confirmed',
      expect.objectContaining({
        orderId: 'order-1',
        customerId: 'customer-1',
        restaurantId: 'restaurant-1',
      }),
    );
  });

  it('ignores a payment for an order that is no longer PLACED', async () => {
    mockedUpdateMany.mockResolvedValueOnce({ count: 0 });

    await handlePaymentSucceeded(event);

    expect(mockedPublish).not.toHaveBeenCalled();
  });
});

describe('handlePaymentFailed', () => {
  it('cancels a PLACED order and publishes order.cancelled with the reason', async () => {
    mockedUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockedFindUnique.mockResolvedValueOnce({ id: 'order-1', customerId: 'customer-1' });

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
        reason: 'Payment failed: Card declined',
      }),
    );
  });
});
