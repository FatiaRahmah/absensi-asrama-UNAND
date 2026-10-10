require('dotenv').config();
const prisma = require('../src/config/database');

async function main() {
  try {
    const users = await prisma.$queryRawUnsafe(
      "SELECT nim, nama, role, LEFT(password,6) as pw_prefix FROM `user` LIMIT 10"
    );
    console.log('=== DATA USER DI DATABASE ===');
    console.log(JSON.stringify(users, null, 2));
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
