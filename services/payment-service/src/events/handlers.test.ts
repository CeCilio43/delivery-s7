import { prisma } from '../prisma';
import { publishEvent } from './eventBus';
import { handleOrderCancelled, handleOrderCreated } from './handlers';

jest.mock('../prisma', () => ({
  prisma: {
    transaction: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));
jest.mock('./eventBus', () => ({ publishEvent: jest.fn(), subscribeToEvent: jest.fn() }));

const mockedFindFirst = prisma.transaction.findFirst as jest.Mock;
const mockedCreate = prisma.transaction.create as jest.Mock;
const mockedUpdate = prisma.transaction.update as jest.Mock;
const mockedUpdateMany = prisma.transaction.updateMany as jest.Mock;
const mockedPublish = publishEvent as jest.Mock;

const orderCreated = (total: number) => ({
  orderId: 'order-1',
  customerId: 'customer-1',
  restaurantId: 'restaurant-1',
  items: [],
  total,
  createdAt: '2026-10-08T12:00:00Z',
});

beforeEach(() => {
  jest.resetAllMocks();
  delete process.env.PAYMENT_DECLINE_ABOVE;
  mockedFindFirst.mockResolvedValue(null);
  mockedCreate.mockResolvedValue({ id: 'pay-1' });
});

describe('handleOrderCreated', () => {
  it('charges the order and publishes payment.succeeded', async () => {
    await handleOrderCreated(orderCreated(25));

    expect(mockedCreate).toHaveBeenCalledWith({
      data: { orderId: 'order-1', customerId: 'customer-1', amount: 25, status: 'PENDING' },
    });
    expect(mockedUpdate.mock.calls[0][0].data.status).toBe('SUCCEEDED');
    expect(mockedPublish).toHaveBeenCalledWith(
      'payment.succeeded',
      expect.objectContaining({ paymentId: 'pay-1', orderId: 'order-1', amount: 25 }),
    );
  });

  it('declines orders above the limit and publishes payment.failed', async () => {
    process.env.PAYMENT_DECLINE_ABOVE = '50';

    await handleOrderCreated(orderCreated(75));

    expect(mockedUpdate.mock.calls[0][0].data.status).toBe('FAILED');
    expect(mockedPublish).toHaveBeenCalledWith(
      'payment.failed',
      expect.objectContaining({ paymentId: 'pay-1', orderId: 'order-1' }),
    );
  });

  it('does not charge the same order twice on redelivery', async () => {
    mockedFindFirst.mockResolvedValueOnce({ id: 'pay-1' });

    await handleOrderCreated(orderCreated(25));

    expect(mockedCreate).not.toHaveBeenCalled();
    expect(mockedPublish).not.toHaveBeenCalled();
  });
});

describe('handleOrderCancelled', () => {
  it('refunds a succeeded payment', async () => {
    await handleOrderCancelled({
      orderId: 'order-1',
      customerId: 'customer-1',
      reason: 'Cancelled by customer',
      cancelledAt: '',
    });

    expect(mockedUpdateMany).toHaveBeenCalledWith({
      where: { orderId: 'order-1', status: 'SUCCEEDED' },
      data: { status: 'REFUNDED' },
    });
  });
});
