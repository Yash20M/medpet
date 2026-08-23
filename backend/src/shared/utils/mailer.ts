import nodemailer, { Transporter } from 'nodemailer';

/**
 * Thin email helper around nodemailer.
 *
 * In production, configure SMTP via env (SMTP_HOST / SMTP_PORT / SMTP_USER /
 * SMTP_PASS / MAIL_FROM). When SMTP is NOT configured (typical in local dev),
 * the mailer falls back to "log mode": it prints the message to the server
 * console instead of sending, and reports `delivered: false` so callers can
 * surface the link (e.g. an invite URL) directly in the admin UI.
 */

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendMailResult {
  /** true when a real email was handed off to an SMTP server. */
  delivered: boolean;
}

const isSmtpConfigured = (): boolean =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT);

let cachedTransporter: Transporter | null = null;

const getTransporter = (): Transporter => {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    // `secure` true for 465 (implicit TLS), false for 587/25 (STARTTLS).
    secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return cachedTransporter;
};

const fromAddress = (): string =>
  process.env.MAIL_FROM ?? `MedPet <${process.env.SMTP_USER ?? 'no-reply@medpet.com'}>`;

export const Mailer = {
  isConfigured: isSmtpConfigured,

  async send(input: SendMailInput): Promise<SendMailResult> {
    if (!isSmtpConfigured()) {
      console.log(
        '\n📧 [mailer:log-mode] SMTP not configured — email NOT sent.\n' +
          `   To:      ${input.to}\n` +
          `   Subject: ${input.subject}\n` +
          `   (set SMTP_HOST/SMTP_PORT/... in .env to enable real delivery)\n`
      );
      return { delivered: false };
    }

    try {
      await getTransporter().sendMail({
        from: fromAddress(),
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      return { delivered: true };
    } catch (err) {
      // Never let a mail failure break the request that triggered it — log and
      // report undelivered so the caller can fall back to showing the link.
      console.error('📧 [mailer] Failed to send email:', (err as Error).message);
      return { delivered: false };
    }
  },
};
