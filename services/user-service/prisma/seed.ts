import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

const CUSTOMER_1_ID = '11111111-1111-1111-1111-111111111111';
const CUSTOMER_2_ID = '11111111-1111-1111-1111-111111111112';
const CUSTOMER_3_ID = '11111111-1111-1111-1111-111111111113';
const OWNER_1_ID = '22222222-2222-2222-2222-222222222221';
const OWNER_2_ID = '22222222-2222-2222-2222-222222222222';
const OWNER_3_ID = '22222222-2222-2222-2222-222222222223';

async function main() {
  const users = [
    { id: CUSTOMER_1_ID, email: 'jamie@example.com', name: 'Jamie Customer', role: Role.CUSTOMER },
    { id: CUSTOMER_2_ID, email: 'alex@example.com', name: 'Alex Customer', role: Role.CUSTOMER },
    { id: CUSTOMER_3_ID, email: 'riley@example.com', name: 'Riley Customer', role: Role.CUSTOMER },
    { id: OWNER_1_ID, email: 'sam@mariospizzeria.com', name: 'Sam Owner', role: Role.RESTAURANT_OWNER },
    { id: OWNER_2_ID, email: 'priya@spiceroute.com', name: 'Priya Owner', role: Role.RESTAURANT_OWNER },
    { id: OWNER_3_ID, email: 'chen@goldenwok.com', name: 'Chen Owner', role: Role.RESTAURANT_OWNER },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        ...user,
        passwordHash: 'placeholder-not-a-real-hash',
      },
    });
  }

  console.log('user-service seeded:', users.length, 'users.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
