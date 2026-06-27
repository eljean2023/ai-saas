import { PrismaClient, Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TEST_ACCOUNTS = [
  { email: 'user@test.com',       password: 'User1234!',       role: Role.USER },
  { email: 'admin@test.com',      password: 'Admin1234!',      role: Role.ADMIN },
  { email: 'superadmin@test.com', password: 'SuperAdmin1234!', role: Role.SUPER_ADMIN },
];

async function main() {
  console.log('\n========================================');
  console.log('  Seeding RBAC test accounts...');
  console.log('========================================\n');

  for (const account of TEST_ACCOUNTS) {
    const passwordHash = await bcrypt.hash(account.password, 12);

    const user = await prisma.user.upsert({
      where:  { email: account.email },
      update: { passwordHash, role: account.role, status: UserStatus.ACTIVE },
      create: { email: account.email, passwordHash, role: account.role, status: UserStatus.ACTIVE },
    });

    const roleLabel = user.role.padEnd(11);
    console.log(`  [${roleLabel}]  ${user.email}`);
    console.log(`               Password: ${account.password}`);
    console.log();
  }

  console.log('========================================');
  console.log('  RBAC Permission Matrix:');
  console.log('========================================');
  console.log('  USER        → Read-only dashboard');
  console.log('  ADMIN       → Full operations, no user creation');
  console.log('  SUPER_ADMIN → Absolute privileges + Add New User');
  console.log('========================================\n');
  console.log('  Seed complete. All accounts are ACTIVE.');
  console.log('========================================\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
