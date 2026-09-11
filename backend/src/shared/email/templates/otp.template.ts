import { EmailBody } from '../email.types';
import { shell, paragraph, smallNote, escapeHtml } from './shared';

/**
 * Sent by DeliveryOtpService when an order goes out for delivery — the
 * customer shares this code with their delivery partner in person to confirm
 * the handoff (see delivery-otp.service.ts). The code is generated fresh each
 * time and never persisted in plain text (only its SHA-256 hash is stored),
 * and never logged.
 */
export const otpEmail = (name: string, code: string, expiresInMinutes: number): EmailBody => {
  const html = shell(
    `Hi ${escapeHtml(name)},`,
    `${paragraph('Your MedPet verification code is:')}
     <div style="font-size:32px;font-weight:800;letter-spacing:6px;color:#0F2A22;background:#F1F5F4;border-radius:12px;padding:16px;text-align:center;margin:12px 0 16px;">
       ${escapeHtml(code)}
     </div>
     ${smallNote(`This code expires in ${expiresInMinutes} minutes.`)}
     ${smallNote("Never share this code with anyone — MedPet staff will never ask you for it.")}`,
    { badge: { label: 'VERIFICATION CODE', tone: 'warning' } }
  );

  const text =
    `Hi ${name},\n\nYour MedPet verification code is ${code}\n\n` +
    `This code expires in ${expiresInMinutes} minutes.\n` +
    `Never share this code with anyone.`;

  return { subject: `Your MedPet verification code is ${code}`, html, text };
};
