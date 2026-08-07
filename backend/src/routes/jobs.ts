import { Router, Request, Response } from 'express';
import { prisma } from '../db';

const router = Router();

/**
 * GET /api/jobs/scheduled
 * Returns PENDING, SCHEDULED, and RATE_LIMITED jobs.
 */
router.get('/scheduled', async (req: Request, res: Response) => {
  try {
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '20', 10);
    const skip = (page - 1) * limit;
    
    const statusParam = req.query.status as string;
    const statuses = statusParam 
      ? statusParam.split(',') 
      : ['PENDING', 'SCHEDULED', 'RATE_LIMITED'];

    const userId = req.query.userId as string;
    const whereClause: any = {
      status: { in: statuses as any }
    };
    if (userId) {
      whereClause.campaign = { userId };
    }

    const [jobs, total] = await Promise.all([
      prisma.emailJob.findMany({
        where: whereClause,
        include: { sender: { select: { email: true, name: true } } },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.emailJob.count({
        where: whereClause,
      }),
    ]);

    return res.json({
      jobs: jobs.map((j) => ({
        id: j.id,
        recipient: j.recipient,
        subject: j.subject,
        body: j.body,
        status: j.status,
        scheduledAt: j.scheduledAt,
        sender: j.sender.email,
        senderName: j.sender.name,
        createdAt: j.createdAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[Jobs] GET /scheduled error:', err);
    return res.status(500).json({ error: 'Failed to fetch scheduled jobs' });
  }
});

/**
 * GET /api/jobs/sent
 * Returns SENT and FAILED jobs.
 */
router.get('/sent', async (req: Request, res: Response) => {
  try {
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '20', 10);
    const skip = (page - 1) * limit;

    const statusParam = req.query.status as string;
    const statuses = statusParam 
      ? statusParam.split(',') 
      : ['SENT', 'FAILED'];

    const userId = req.query.userId as string;
    const whereClause: any = {
      status: { in: statuses as any }
    };
    if (userId) {
      whereClause.campaign = { userId };
    }

    const [jobs, total] = await Promise.all([
      prisma.emailJob.findMany({
        where: whereClause,
        include: { sender: { select: { email: true, name: true } } },
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.emailJob.count({
        where: whereClause,
      }),
    ]);

    return res.json({
      jobs: jobs.map((j) => ({
        id: j.id,
        recipient: j.recipient,
        subject: j.subject,
        body: j.body,
        status: j.status,
        scheduledAt: j.scheduledAt,
        sentAt: j.sentAt,
        sender: j.sender.email,
        senderName: j.sender.name,
        error: j.error,
        createdAt: j.createdAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[Jobs] GET /sent error:', err);
    return res.status(500).json({ error: 'Failed to fetch sent jobs' });
  }
});

/**
 * GET /api/jobs/stats
 * Returns aggregate counts by status.
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const whereClause: any = {};
    if (userId) {
      whereClause.campaign = { userId };
    }

    const stats = await prisma.emailJob.groupBy({
      by: ['status'],
      where: whereClause,
      _count: { _all: true },
    });
    const result: Record<string, number> = {};
    for (const s of stats) {
      result[s.status] = s._count._all;
    }
    return res.json(result);
  } catch (err) {
    console.error('[Jobs] GET /stats error:', err);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/jobs/:id
 * Returns details for a single job.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const job = await prisma.emailJob.findUnique({
      where: { id },
      include: { sender: { select: { email: true, name: true } } },
    }) as any;
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    return res.json({
      id: job.id,
      recipient: job.recipient,
      subject: job.subject,
      body: job.body,
      status: job.status,
      scheduledAt: job.scheduledAt,
      sentAt: job.sentAt,
      sender: job.sender.email,
      senderName: job.sender.name,
      error: job.error,
      createdAt: job.createdAt,
    });
  } catch (err) {
    console.error('[Jobs] GET /:id error:', err);
    return res.status(500).json({ error: 'Failed to fetch job details' });
  }
});

export default router;
