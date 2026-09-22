import { PrismaClient, OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

const CUSTOMER_1_ID = '11111111-1111-1111-1111-111111111111';
const CUSTOMER_2_ID = '11111111-1111-1111-1111-111111111112';
const CUSTOMER_3_ID = '11111111-1111-1111-1111-111111111113';

const RESTAURANT_1_ID = '33333333-3333-3333-3333-333333333331';
const RESTAURANT_2_ID = '33333333-3333-3333-3333-333333333332';
const RESTAURANT_3_ID = '33333333-3333-3333-3333-333333333333';

const ORDER_1_ID = '66666666-6666-6666-6666-666666666661';
const ORDER_2_ID = '66666666-6666-6666-6666-666666666662';
const ORDER_3_ID = '66666666-6666-6666-6666-666666666663';
const ORDER_4_ID = '66666666-6666-6666-6666-666666666664';

async function main() {
  const orders = [
    {
      id: ORDER_1_ID,
      customerId: CUSTOMER_1_ID,
      restaurantId: RESTAURANT_1_ID,
      status: OrderStatus.CONFIRMED,
      totalAmount: 17.0,
      lines: [
        { menuItemId: '44444444-4444-4444-4444-444444444441', name: 'Margherita Pizza', unitPrice: 12.5, quantity: 1 },
        { menuItemId: '44444444-4444-4444-4444-444444444442', name: 'Garlic Bread', unitPrice: 4.5, quantity: 1 },
      ],
    },
    {
      id: ORDER_2_ID,
      customerId: CUSTOMER_2_ID,
      restaurantId: RESTAURANT_2_ID,
      status: OrderStatus.PLACED,
      totalAmount: 16.0,
      lines: [
        { menuItemId: '44444444-4444-4444-4444-444444444444', name: 'Chicken Tikka Masala', unitPrice: 13.0, quantity: 1 },
        { menuItemId: '44444444-4444-4444-4444-444444444445', name: 'Garlic Naan', unitPrice: 3.0, quantity: 1 },
      ],
    },
    {
      id: ORDER_3_ID,
      customerId: CUSTOMER_3_ID,
      restaurantId: RESTAURANT_3_ID,
      status: OrderStatus.DELIVERED,
      totalAmount: 20.5,
      lines: [
        { menuItemId: '44444444-4444-4444-4444-444444444447', name: 'Kung Pao Chicken', unitPrice: 11.5, quantity: 1 },
        { menuItemId: '44444444-4444-4444-4444-444444444448', name: 'Spring Rolls (4pc)', unitPrice: 5.0, quantity: 1 },
        { menuItemId: '44444444-4444-4444-4444-444444444449', name: 'Egg Fried Rice', unitPrice: 4.0, quantity: 1 },
      ],
    },
    {
      id: ORDER_4_ID,
      customerId: CUSTOMER_1_ID,
      restaurantId: RESTAURANT_3_ID,
      status: OrderStatus.CANCELLED,
      totalAmount: 4.0,
      lines: [
        { menuItemId: '44444444-4444-4444-4444-444444444449', name: 'Egg Fried Rice', unitPrice: 4.0, quantity: 1 },
      ],
    },
  ];

  for (const order of orders) {
    const { lines, ...orderData } = order;
    await prisma.order.upsert({
      where: { id: order.id },
      update: {},
      create: {
        ...orderData,
        lines: { create: lines },
      },
    });
  }

  console.log('order-service seeded:', orders.length, 'orders.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
