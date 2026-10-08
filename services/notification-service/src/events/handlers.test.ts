import { notifyOrderStatus } from './handlers';
import { sendToUser } from '../ws/notificationSocket';

jest.mock('../ws/notificationSocket', () => ({ sendToUser: jest.fn() }));
jest.mock('./eventBus', () => ({ subscribeToEvent: jest.fn() }));

const mockedSend = sendToUser as jest.Mock;

beforeEach(() => jest.resetAllMocks());

const event = {
  orderId: 'order-1',
  customerId: 'customer-1',
  restaurantId: 'restaurant-1',
  restaurantOwnerId: 'owner-1',
};

describe('notifyOrderStatus', () => {
  it('tells the customer and the restaurant owner, each in their own format', () => {
    notifyOrderStatus(event, 'PREPARING');

    expect(mockedSend).toHaveBeenCalledWith('customer-1', {
      type: 'order.updated',
      orderId: 'order-1',
      status: 'PREPARING',
    });
    expect(mockedSend).toHaveBeenCalledWith('owner-1', {
      type: 'restaurant.order_updated',
      orderId: 'order-1',
      restaurantId: 'restaurant-1',
      status: 'PREPARING',
    });
  });

  it('passes on the cancellation reason', () => {
    notifyOrderStatus({ ...event, reason: 'Rejected by the restaurant' }, 'CANCELLED');

    expect(mockedSend).toHaveBeenCalledWith(
      'customer-1',
      expect.objectContaining({ status: 'CANCELLED', reason: 'Rejected by the restaurant' }),
    );
  });

  it('only tells the customer when the owner is unknown', () => {
    notifyOrderStatus({ ...event, restaurantOwnerId: null }, 'CONFIRMED');

    expect(mockedSend).toHaveBeenCalledTimes(1);
    expect(mockedSend).toHaveBeenCalledWith('customer-1', expect.anything());
  });
});
