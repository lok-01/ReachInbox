import { prisma } from './db';
import { redis } from './redis';

async function resetAll() {
  console.log('🔄 Starting database and Redis reset...');

  try {
    // 1. Clear database tables in order of relationships
    console.log(' Wiping MySQL database tables...');
    await prisma.emailJob.deleteMany();
    await prisma.emailCampaign.deleteMany();
    await prisma.sender.deleteMany();
    await prisma.user.deleteMany();
    console.log('✅ Database tables wiped successfully.');

    // 2. Clear Redis cache and queues
    console.log(' Wiping Redis keys...');
    await redis.flushall();
    console.log('✅ Redis database flushed successfully.');

  } catch (err) {
    console.error('❌ Reset failed:', err);
  } finally {
    // Close connections
    await prisma.$disconnect();
    redis.disconnect();
    console.log('👋 Connections closed. Reset complete.');
    process.exit(0);
  }
}

resetAll();
