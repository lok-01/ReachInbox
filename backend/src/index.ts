import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import sendersRouter from './routes/senders';
import jobsRouter from './routes/jobs';
import campaignsRouter from './routes/campaigns';
import { startWorker, startQueueEvents } from './queue';
import { recoverJobs } from './recovery';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

import { redis } from './redis';
import { prisma } from './db';

// Routes
app.use('/api/auth', authRouter);
app.use('/api/senders', sendersRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/campaigns', campaignsRouter);

// Database & Redis Admin Reset Endpoint (accessible via GET/POST)
app.all('/api/admin/reset', async (req, res) => {
  try {
    console.log('🔄 Starting Database and Redis reset via HTTP endpoint...');

    // 1. Wipes all rows in order of database constraints
    const wipedJobs = await prisma.emailJob.deleteMany();
    const wipedSenders = await prisma.sender.deleteMany();
    const wipedUsers = await prisma.user.deleteMany();

    // 2. Clears all Redis memory (Queue keys & Rate Limit counters)
    await redis.flushall();

    console.log('✅ Database and Redis reset complete.');
    return res.json({
      success: true,
      message: 'Database and Redis successfully wiped.',
      details: {
        jobsWiped: wipedJobs.count,
        sendersWiped: wipedSenders.count,
        usersWiped: wipedUsers.count,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('❌ Admin reset failed:', err);
    return res.status(500).json({ error: 'Reset failed', details: msg });
  }
});

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Unhandled Error]:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start services
async function main() {
  try {
    // Start BullMQ Background Worker and Events
    startWorker();
    startQueueEvents();

    // Run job recovery on startup to handle crashes or Redis flushes
    await recoverJobs();

    // Start Express Server
    app.listen(PORT, () => {
      console.log(`[Server] Express server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('[Server] Critical error starting application:', error);
    process.exit(1);
  }
}

main();
