import nodemailer, { Transporter } from 'nodemailer';

/**
 * Single reusable SMTP transporter for the whole app (Gmail SMTP + App Password
 * by default). Required env vars — see .env.example:
 *   MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM_EMAIL, MAIL_FROM_NAME
 *
 * When email isn't configured (typical in local dev) `isEmailConfigured()` is
 * false and callers fall back to "log mode" instead of crashing the API.
 */

export const REQUIRED_EMAIL_ENV_VARS = [
  'MAIL_HOST', 'MAIL_PORT', 'MAIL_USERNAME', 'MAIL_PASSWORD', 'MAIL_FROM_EMAIL', 'MAIL_FROM_NAME',
] as const;

export const isEmailConfigured = (): boolean =>
  REQUIRED_EMAIL_ENV_VARS.every((key) => Boolean(process.env[key]));

let cachedTransporter: Transporter | null = null;

export const getTransporter = (): Transporter => {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT) || 587,
    // STARTTLS on 587 (Gmail's recommended port) — secure:false lets nodemailer
    // upgrade the connection itself. Only force implicit TLS when MAIL_SECURE=true.
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD,
    },
  });
  return cachedTransporter;
};

export const fromAddress = (): string =>
  `${process.env.MAIL_FROM_NAME ?? 'MedPet'} <${process.env.MAIL_FROM_EMAIL ?? process.env.MAIL_USERNAME}>`;

/**
 * Verify SMTP credentials at startup. Never throws — logs and lets the API
 * keep running in log-mode so an SMTP outage can't take the whole server down.
 */
export const verifyEmailConfig = async (): Promise<void> => {
  if (!isEmailConfigured()) {
    const missing = REQUIRED_EMAIL_ENV_VARS.filter((key) => !process.env[key]);
    console.warn(
      `📧 Email not configured — missing env vars: ${missing.join(', ')}. ` +
        'Emails will be logged instead of sent. See .env.example.'
    );
    return;
  }
  try {
    await getTransporter().verify();
    console.log(`📧 Email ready — sending as ${fromAddress()}`);
  } catch (err) {
    console.error('📧 Email SMTP verification failed (emails will be retried on send):', (err as Error).message);
  }
};
