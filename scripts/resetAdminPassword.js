require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/database');

async function main() {
  const nim = '2311522001'; // NIM admin
  const newPassword = 'admin123';
  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.$executeRawUnsafe(
    'UPDATE `user` SET password = ? WHERE nim = ?',
    hashed, nim
  );
  console.log(`✅ Password admin NIM "${nim}" berhasil direset menjadi: ${newPassword}`);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); prisma.$disconnect(); });
