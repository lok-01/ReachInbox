import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../db';
import { enqueueEmailJob } from '../queue';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper to extract all valid emails from a string using regex
function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  // Return unique emails
  return Array.from(new Set(matches.map((email) => email.toLowerCase().trim())));
}

/**
 * POST /api/campaigns
 * Body schema:
 * - userId: string
 * - senderId: string
 * - subject: string
 * - body: string
 * - startTime: string (ISO string)
 * - delaySeconds: number
 * - hourlyLimit: number
 * - manualLeads?: string (comma/newline separated emails)
 * - file: file upload (optional)
 */
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { userId, senderId, subject, body, startTime, delaySeconds, hourlyLimit, manualLeads } = req.body;

    if (!userId || !senderId || !subject || !body || !startTime) {
      return res.status(400).json({ error: 'Missing required campaign details.' });
    }

    const startDateTime = new Date(startTime);
    if (isNaN(startDateTime.getTime())) {
      return res.status(400).json({ error: 'Invalid start time value.' });
    }

    const delay = parseInt(delaySeconds || '2', 10);
    const limit = parseInt(hourlyLimit || '100', 10);

    // Verify sender exists
    const sender = await prisma.sender.findUnique({
      where: { id: senderId },
    });
    if (!sender) {
      return res.status(404).json({ error: 'Sender not found.' });
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Extract emails from file or manual input
    let leads: string[] = [];

    if (req.file) {
      const fileContent = req.file.buffer.toString('utf-8');
      leads = extractEmails(fileContent);
    } else if (manualLeads) {
      leads = extractEmails(manualLeads);
    }

    if (leads.length === 0) {
      return res.status(400).json({ error: 'No valid lead email addresses detected.' });
    }

    // Save campaign in DB
    const campaign = await prisma.emailCampaign.create({
      data: {
        userId,
        subject,
        body,
        startTime: startDateTime,
        delaySeconds: delay,
        hourlyLimit: limit,
      },
    });

    console.log(`[Campaigns] Created campaign ${campaign.id} with ${leads.length} leads`);

    // Create and schedule jobs in DB and BullMQ
    const emailJobsData = [];
    const scheduledJobs = [];

    for (let i = 0; i < leads.length; i++) {
      const recipient = leads[i];
      // Delay scheduling sequentially
      const scheduledAt = new Date(startDateTime.getTime() + i * delay * 1000);

      // Create email job in database
      const emailJob = await prisma.emailJob.create({
        data: {
          campaignId: campaign.id,
          senderId,
          recipient,
          subject,
          body,
          status: 'PENDING',
          scheduledAt,
        },
      });

      emailJobsData.push(emailJob);

      // Enqueue in BullMQ with computed delay
      await enqueueEmailJob(emailJob.id, scheduledAt);
      scheduledJobs.push({ jobId: emailJob.id, scheduledAt });
    }

    return res.status(201).json({
      message: 'Campaign scheduled successfully.',
      campaignId: campaign.id,
      leadsCount: leads.length,
      jobs: scheduledJobs,
    });
  } catch (err) {
    console.error('[Campaigns] POST error:', err);
    return res.status(500).json({ error: 'Failed to create campaign' });
  }
});

export default router;
