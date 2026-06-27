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

  // Seed AILog rows linked to the admin user
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@test.com' } });
  if (adminUser) {
    const aiLogs = [
      {
        userId:     adminUser.id,
        prompt:     'Optimize this SQL index query for a 50M-row users table with frequent range scans on createdAt and status columns. Current query takes 4s, target <200ms.',
        response:   'Recommended a composite index on (status, createdAt DESC), partitioning by year, and a covering index for the SELECT columns. Also suggested enabling pg_stat_statements to profile the query planner decisions. Expected reduction to ~80ms after VACUUM ANALYZE.',
        tokensUsed: 1247,
        endpoint:   '/api/ai/analytics',
      },
      {
        userId:     adminUser.id,
        prompt:     'Generate a full RAG workflow with Mastra: ingest PDF documents into a Pinecone vector store, chunk with 512-token overlap, embed with text-embedding-3-large, and expose a streaming /query endpoint with citation sources.',
        response:   'Produced a complete Mastra pipeline with DocumentLoader, RecursiveCharacterTextSplitter (512 tokens, 64 overlap), OpenAI embedding integration, Pinecone upsert with metadata (source, page, chunkIndex), and a streaming Next.js API route that returns delta tokens plus a citations array from the top-3 retrieved chunks.',
        tokensUsed: 4512,
        endpoint:   '/api/ai/chat',
      },
      {
        userId:     adminUser.id,
        prompt:     'Design a multi-tenant RBAC middleware for Next.js App Router that enforces USER / ADMIN / SUPER_ADMIN permissions at the route segment level using JWT claims and Prisma session validation.',
        response:   'Delivered a withRBAC higher-order server component that decodes the HttpOnly JWT, validates the session row in Postgres, and redirects with a 403 payload if the role claim is insufficient. Included an edge-compatible version using jose for the middleware.ts file and unit test stubs with MSW for the Prisma mock layer.',
        tokensUsed: 3891,
        endpoint:   '/api/ai/chat',
      },
    ];

    for (const log of aiLogs) {
      await prisma.aILog.create({ data: log });
    }

    console.log('========================================');
    console.log('  AI Monitor seed data:');
    console.log('========================================');
    for (const log of aiLogs) {
      console.log(`  [${log.endpoint.padEnd(20)}]  ${log.tokensUsed} tokens`);
    }
    console.log('========================================\n');
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
