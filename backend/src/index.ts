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

// Routes
app.use('/api/auth', authRouter);
app.use('/api/senders', sendersRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/campaigns', campaignsRouter);

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
