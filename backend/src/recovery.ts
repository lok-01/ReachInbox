import { prisma } from './db';
import { emailQueue, enqueueEmailJob } from './queue';

/**
 * On server startup, re-enqueue any jobs that are PENDING, SCHEDULED, or
 * RATE_LIMITED but are NOT present in the BullMQ queue (e.g., after a Redis
 * flush or a server crash).
 *
 * This guarantees persistence across restarts without re-sending already-sent
 * emails (SENT/FAILED jobs are skipped).
 */
export async function recoverJobs(): Promise<void> {
  console.log('[Recovery] Starting job recovery check...');

  const pendingJobs = await prisma.emailJob.findMany({
    where: {
      status: {
        in: ['PENDING', 'SCHEDULED', 'RATE_LIMITED'],
      },
    },
    orderBy: { scheduledAt: 'asc' },
  });

  if (pendingJobs.length === 0) {
    console.log('[Recovery] No pending jobs to recover.');
    return;
  }

  console.log(`[Recovery] Found ${pendingJobs.length} job(s) to verify...`);

  let recovered = 0;
  let alreadyQueued = 0;

  for (const job of pendingJobs) {
    // Check if already in BullMQ queue
    const existing = await emailQueue.getJob(job.id);

    if (existing) {
      const state = await existing.getState();
      // If it's delayed, waiting, or active – it's already managed
      if (['delayed', 'waiting', 'active'].includes(state)) {
        alreadyQueued++;
        continue;
      }
    }

    // Not in queue – re-enqueue it
    // For RATE_LIMITED jobs, schedule them for start of next hour
    let targetTime = job.scheduledAt;
    if (job.status === 'RATE_LIMITED') {
      const nextHour = new Date();
      nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
      targetTime = nextHour;
    }

    try {
      await enqueueEmailJob(job.id, targetTime);
      // Reset status back to PENDING so worker can process it fresh
      await prisma.emailJob.update({
        where: { id: job.id },
        data: { status: 'PENDING' },
      });
      recovered++;
      console.log(`[Recovery] Re-enqueued job ${job.id} for ${targetTime.toISOString()}`);
    } catch (err) {
      console.error(`[Recovery] Failed to re-enqueue job ${job.id}:`, err);
    }
  }

  console.log(
    `[Recovery] Done. Recovered: ${recovered}, Already queued: ${alreadyQueued}, Total checked: ${pendingJobs.length}`
  );
}
