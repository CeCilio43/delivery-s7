import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OWNER_1_ID = '22222222-2222-2222-2222-222222222221';
const OWNER_2_ID = '22222222-2222-2222-2222-222222222222';
const OWNER_3_ID = '22222222-2222-2222-2222-222222222223';

const RESTAURANT_1_ID = '33333333-3333-3333-3333-333333333331';
const RESTAURANT_2_ID = '33333333-3333-3333-3333-333333333332';
const RESTAURANT_3_ID = '33333333-3333-3333-3333-333333333333';

async function main() {
  const restaurants = [
    { id: RESTAURANT_1_ID, ownerId: OWNER_1_ID, name: "Mario's Pizzeria", cuisine: 'Italian', address: '12 Market Street' },
    { id: RESTAURANT_2_ID, ownerId: OWNER_2_ID, name: 'Spice Route', cuisine: 'Indian', address: '48 Curry Lane' },
    { id: RESTAURANT_3_ID, ownerId: OWNER_3_ID, name: 'Golden Wok', cuisine: 'Chinese', address: '7 Dragon Avenue' },
  ];

  for (const r of restaurants) {
    await prisma.restaurant.upsert({
      where: { id: r.id },
      update: {},
      create: { ...r, isOpen: true },
    });
  }

  const menuItems = [
    { id: '44444444-4444-4444-4444-444444444441', restaurantId: RESTAURANT_1_ID, name: 'Margherita Pizza', price: 12.5 },
    { id: '44444444-4444-4444-4444-444444444442', restaurantId: RESTAURANT_1_ID, name: 'Garlic Bread', price: 4.5 },
    { id: '44444444-4444-4444-4444-444444444443', restaurantId: RESTAURANT_1_ID, name: 'Tiramisu', price: 6.0 },
    { id: '44444444-4444-4444-4444-444444444444', restaurantId: RESTAURANT_2_ID, name: 'Chicken Tikka Masala', price: 13.0 },
    { id: '44444444-4444-4444-4444-444444444445', restaurantId: RESTAURANT_2_ID, name: 'Garlic Naan', price: 3.0 },
    { id: '44444444-4444-4444-4444-444444444446', restaurantId: RESTAURANT_2_ID, name: 'Mango Lassi', price: 3.5 },
    { id: '44444444-4444-4444-4444-444444444447', restaurantId: RESTAURANT_3_ID, name: 'Kung Pao Chicken', price: 11.5 },
    { id: '44444444-4444-4444-4444-444444444448', restaurantId: RESTAURANT_3_ID, name: 'Spring Rolls (4pc)', price: 5.0 },
    { id: '44444444-4444-4444-4444-444444444449', restaurantId: RESTAURANT_3_ID, name: 'Egg Fried Rice', price: 4.0 },
  ];

  for (const item of menuItems) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {},
      create: { ...item, isAvailable: true },
    });
  }

  console.log('restaurant-service seeded:', restaurants.length, 'restaurants,', menuItems.length, 'menu items.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
