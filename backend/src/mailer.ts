import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export interface SenderCredentials {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

/**
 * Creates a Nodemailer transporter for the given sender credentials.
 */
export function createTransporter(creds: SenderCredentials) {
  return nodemailer.createTransport({
    host: creds.host,
    port: creds.port,
    secure: false,
    auth: {
      user: creds.user,
      pass: creds.pass,
    },
  });
}

/**
 * Creates (or reuses) an Ethereal Email account.
 * Call this once at startup if ETHEREAL_USER is not set.
 */
export async function createEtherealAccount(): Promise<{
  user: string;
  pass: string;
  host: string;
  port: number;
  email: string;
}> {
  const testAccount = await nodemailer.createTestAccount();
  console.log('[Mailer] Ethereal test account created:', testAccount.user);
  console.log('[Mailer] Preview emails at: https://ethereal.email');
  return {
    user: testAccount.user,
    pass: testAccount.pass,
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    email: testAccount.user,
  };
}

/**
 * Send an email using given transporter. Returns preview URL (Ethereal).
 */
export async function sendEmail(
  transporter: nodemailer.Transporter,
  fromEmail: string,
  fromName: string,
  to: string,
  subject: string,
  html: string
): Promise<{ messageId: string; previewUrl: string | false }> {
  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log(`[Mailer] Email sent to ${to} | Message ID: ${info.messageId}`);
  if (previewUrl) {
    console.log(`[Mailer] Preview URL: ${previewUrl}`);
  }

  return { messageId: info.messageId, previewUrl };
}
