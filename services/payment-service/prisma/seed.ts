import { PrismaClient, PaymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

const CUSTOMER_1_ID = '11111111-1111-1111-1111-111111111111';
const CUSTOMER_2_ID = '11111111-1111-1111-1111-111111111112';
const CUSTOMER_3_ID = '11111111-1111-1111-1111-111111111113';

const ORDER_1_ID = '66666666-6666-6666-6666-666666666661';
const ORDER_2_ID = '66666666-6666-6666-6666-666666666662';
const ORDER_3_ID = '66666666-6666-6666-6666-666666666663';
const ORDER_4_ID = '66666666-6666-6666-6666-666666666664';

async function main() {
  const transactions = [
    { id: '77777777-7777-7777-7777-777777777771', orderId: ORDER_1_ID, customerId: CUSTOMER_1_ID, amount: 17.0, status: PaymentStatus.SUCCEEDED, providerRef: 'demo-ref-001' },
    { id: '77777777-7777-7777-7777-777777777772', orderId: ORDER_2_ID, customerId: CUSTOMER_2_ID, amount: 16.0, status: PaymentStatus.PENDING, providerRef: 'demo-ref-002' },
    { id: '77777777-7777-7777-7777-777777777773', orderId: ORDER_3_ID, customerId: CUSTOMER_3_ID, amount: 20.5, status: PaymentStatus.SUCCEEDED, providerRef: 'demo-ref-003' },
    { id: '77777777-7777-7777-7777-777777777774', orderId: ORDER_4_ID, customerId: CUSTOMER_1_ID, amount: 4.0, status: PaymentStatus.FAILED, providerRef: 'demo-ref-004' },
  ];

  for (const t of transactions) {
    await prisma.transaction.upsert({
      where: { id: t.id },
      update: {},
      create: t,
    });
  }

  console.log('payment-service seeded:', transactions.length, 'transactions.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
