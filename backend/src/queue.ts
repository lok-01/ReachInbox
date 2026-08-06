import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import dotenv from 'dotenv';
import { prisma } from './db';
import { createRedisConnection, redis } from './redis';
import { createTransporter, sendEmail } from './mailer';

dotenv.config();

const QUEUE_NAME = 'email-queue';

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
const MIN_DELAY_MS = parseInt(process.env.MIN_DELAY_MS || '2000', 10);
const DEFAULT_HOURLY_LIMIT = parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '200', 10);

// -------------------------------------------------------------------
// Queue instance (used by API to add jobs)
// -------------------------------------------------------------------
export const emailQueue = new Queue(QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
});

// -------------------------------------------------------------------
// Rate-limit helper using Redis INCR with hourly windows
// -------------------------------------------------------------------
async function checkAndIncrRateLimit(senderId: string, hourlyLimit: number): Promise<boolean> {
  const now = new Date();
  const hourKey = `rate_limit:${senderId}:${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}`;

  // INCR is atomic – safe across multiple workers
  const current = await redis.incr(hourKey);

  // Set expiry on first creation (2 hours to be safe)
  if (current === 1) {
    await redis.expire(hourKey, 7200);
  }

  return current <= hourlyLimit;
}

/**
 * Calculate delay (ms) until the start of the next UTC hour.
 */
function msUntilNextHour(): number {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
  return nextHour.getTime() - now.getTime();
}

// -------------------------------------------------------------------
// Enqueue a single email job (idempotent via job ID = DB job ID)
// -------------------------------------------------------------------
export async function enqueueEmailJob(jobId: string, scheduledAt: Date): Promise<void> {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());

  await emailQueue.add(
    'send-email',
    { jobId },
    {
      jobId,          // idempotent: BullMQ ignores duplicates with same jobId
      delay,
    }
  );
}

// -------------------------------------------------------------------
// Worker – processes email send jobs
// -------------------------------------------------------------------
export function startWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const { jobId } = job.data as { jobId: string };

      // Fetch full job details from DB
      const emailJob = await prisma.emailJob.findUnique({
        where: { id: jobId },
        include: { sender: true, campaign: true },
      });

      if (!emailJob) {
        throw new Error(`EmailJob ${jobId} not found in database`);
      }

      // Already sent – skip (idempotency guard)
      if (emailJob.status === 'SENT') {
        console.log(`[Worker] Job ${jobId} already sent – skipping`);
        return;
      }

      // Determine effective hourly limit (campaign > sender default)
      const hourlyLimit = emailJob.campaign?.hourlyLimit ?? DEFAULT_HOURLY_LIMIT;

      // ---- Rate limit check ----
      const allowed = await checkAndIncrRateLimit(emailJob.senderId, hourlyLimit);

      if (!allowed) {
        const delayMs = msUntilNextHour();
        console.warn(
          `[Worker] Rate limit reached for sender ${emailJob.senderId}. Rescheduling job ${jobId} in ${Math.round(delayMs / 1000)}s`
        );

        // Mark as RATE_LIMITED in DB
        await prisma.emailJob.update({
          where: { id: jobId },
          data: { status: 'RATE_LIMITED' },
        });

        // Re-enqueue for next hour (same idempotent key → BullMQ will update delay)
        await emailQueue.add(
          'send-email',
          { jobId },
          {
            delay: delayMs,
            // Remove old job ID so a new delayed entry is created
          }
        );

        return;
      }

      // ---- Enforce minimum delay between sends ----
      if (MIN_DELAY_MS > 0) {
        await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_MS));
      }

      // ---- Send email ----
      try {
        await prisma.emailJob.update({
          where: { id: jobId },
          data: { status: 'SCHEDULED' },
        });

        const { sender } = emailJob;
        const transporter = createTransporter({
          host: sender.host,
          port: sender.port,
          user: sender.user,
          pass: sender.pass,
          fromName: sender.name,
          fromEmail: sender.email,
        });

        await sendEmail(
          transporter,
          sender.email,
          sender.name,
          emailJob.recipient,
          emailJob.subject,
          emailJob.body
        );

        await prisma.emailJob.update({
          where: { id: jobId },
          data: { status: 'SENT', sentAt: new Date() },
        });

        console.log(`[Worker] ✅ Sent email to ${emailJob.recipient} (job ${jobId})`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[Worker] ❌ Failed to send job ${jobId}: ${errorMessage}`);

        await prisma.emailJob.update({
          where: { id: jobId },
          data: { status: 'FAILED', error: errorMessage },
        });

        // Re-throw so BullMQ can retry per backoff policy
        throw err;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: WORKER_CONCURRENCY,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed after retries: ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err.message);
  });

  console.log(`[Worker] Started with concurrency=${WORKER_CONCURRENCY}, minDelay=${MIN_DELAY_MS}ms`);
  return worker;
}

// -------------------------------------------------------------------
// QueueEvents for monitoring (optional logging)
// -------------------------------------------------------------------
export function startQueueEvents(): QueueEvents {
  const queueEvents = new QueueEvents(QUEUE_NAME, {
    connection: createRedisConnection(),
  });

  queueEvents.on('waiting', ({ jobId }) => {
    console.log(`[Queue] Job ${jobId} is waiting`);
  });

  return queueEvents;
}
