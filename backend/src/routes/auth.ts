import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../db';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/google
 * Verifies a Google ID token, upserts the user in DB, returns user profile.
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body as { credential: string };

    console.log('[Auth] Google OAuth debug:', {
      configuredClientId: process.env.GOOGLE_CLIENT_ID,
      tokenLength: credential ? credential.length : 0
    });

    if (!credential) {
      return res.status(400).json({ error: 'Missing Google credential token' });
    }

    // Verify the token with Google
    const client_id = process.env.GOOGLE_CLIENT_ID || '';
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: client_id.trim(),
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).json({ error: 'Invalid Google token payload' });
    }

    // Upsert user into DB
    const user = await prisma.user.upsert({
      where: { email: payload.email },
      update: {
        name: payload.name || payload.email,
        avatar: payload.picture || null,
      },
      create: {
        email: payload.email,
        name: payload.name || payload.email,
        avatar: payload.picture || null,
      },
    });

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    });
  } catch (err) {
    console.error('[Auth] Google auth error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
});

export default router;
