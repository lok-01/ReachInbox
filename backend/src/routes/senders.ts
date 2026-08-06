import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { createEtherealAccount, createTransporter } from '../mailer';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

/**
 * GET /api/senders
 * List all registered senders.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const senders = await prisma.sender.findMany({
      select: { id: true, email: true, name: true, host: true, port: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(senders);
  } catch (err) {
    console.error('[Senders] GET error:', err);
    return res.status(500).json({ error: 'Failed to fetch senders' });
  }
});

/**
 * POST /api/senders
 * Register a new sender with SMTP credentials.
 * If no credentials provided and type = "ethereal", auto-create an Ethereal account.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { type, name, email, host, port, user, pass } = req.body as {
      type?: string;
      name?: string;
      email?: string;
      host?: string;
      port?: number;
      user?: string;
      pass?: string;
    };

    let senderData: {
      email: string;
      name: string;
      host: string;
      port: number;
      user: string;
      pass: string;
    };

    if (type === 'ethereal' || !host) {
      // Auto-create Ethereal account
      const account = await createEtherealAccount();
      senderData = {
        email: account.email,
        name: name || 'ReachInbox Sender',
        host: account.host,
        port: account.port,
        user: account.user,
        pass: account.pass,
      };
    } else {
      if (!email || !host || !port || !user || !pass) {
        return res.status(400).json({
          error: 'Missing required fields: email, host, port, user, pass',
        });
      }

      // Verify SMTP credentials by attempting a connection
      const transporter = createTransporter({
        host,
        port,
        user,
        pass,
        fromName: name || email,
        fromEmail: email,
      });

      await transporter.verify();

      senderData = {
        email,
        name: name || email,
        host,
        port,
        user,
        pass,
      };
    }

    const sender = await prisma.sender.upsert({
      where: { email: senderData.email },
      update: { name: senderData.name, host: senderData.host, port: senderData.port, user: senderData.user, pass: senderData.pass },
      create: senderData,
    });

    return res.status(201).json({
      id: sender.id,
      email: sender.email,
      name: sender.name,
      host: sender.host,
      port: sender.port,
      createdAt: sender.createdAt,
    });
  } catch (err) {
    console.error('[Senders] POST error:', err);
    return res.status(500).json({ error: 'Failed to create sender' });
  }
});

export default router;
