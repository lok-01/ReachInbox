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

    const [jobs, total] = await Promise.all([
      prisma.emailJob.findMany({
        where: { status: { in: statuses as any } },
        include: { sender: { select: { email: true, name: true } } },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.emailJob.count({
        where: { status: { in: statuses as any } },
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

    const [jobs, total] = await Promise.all([
      prisma.emailJob.findMany({
        where: { status: { in: statuses as any } },
        include: { sender: { select: { email: true, name: true } } },
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.emailJob.count({
        where: { status: { in: statuses as any } },
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
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await prisma.emailJob.groupBy({
      by: ['status'],
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

export default router;
