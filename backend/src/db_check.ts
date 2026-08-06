import { prisma } from './db';

async function main() {
  console.log('=== CAMPAIGNS ===');
  const campaigns = await prisma.emailCampaign.findMany();
  console.dir(campaigns);

  console.log('=== JOBS ===');
  const jobs = await prisma.emailJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.dir(jobs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
