import { EmailService } from '../email/email.service';

/**
 * Thin backward-compatible wrapper around EmailService.sendEmail, kept so
 * existing non-order call sites (delivery-partner invite emails) don't need
 * to change. See shared/config/email.ts for the actual SMTP transporter and
 * shared/email/email.service.ts for the transactional-email pipeline.
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

export const Mailer = {
  isConfigured: EmailService.isConfigured,

  async send(input: SendMailInput): Promise<SendMailResult> {
    return EmailService.sendEmail(input.to, {
      subject: input.subject,
      html: input.html,
      text: input.text ?? '',
    });
  },
};
