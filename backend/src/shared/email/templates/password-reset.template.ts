import { EmailBody } from '../email.types';
import { shell, button, paragraph, smallNote, escapeHtml } from './shared';

/** The `url` must contain the real single-use reset token issued by AuthService
 *  (see auth.service.ts issueResetToken) — never a placeholder. */
export const passwordResetEmail = (name: string, url: string, expiresAt: Date): EmailBody => {
  const expiryText = expiresAt.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit',
  });

  const html = shell(
    `Hi ${escapeHtml(name)},`,
    `${paragraph('We received a request to reset your MedPet password. Click below to choose a new one.')}
     ${button(url, 'Reset password')}
     <p style="color:#6B8079;font-size:13px;line-height:1.6;margin:0 0 4px;">
       Or copy this link into your browser:<br/>
       <a href="${escapeHtml(url)}" style="color:#059669;word-break:break-all;">${escapeHtml(url)}</a>
     </p>
     ${smallNote(`This link expires on ${expiryText}.`)}
     ${smallNote("If you didn't request this, you can safely ignore this email — your password won't be changed.")}`,
    { badge: { label: 'PASSWORD RESET', tone: 'warning' } }
  );

  const text =
    `Hi ${name},\n\nReset your MedPet password here:\n${url}\n\n` +
    `This link expires on ${expiryText}.\n\n` +
    `If you didn't request this, you can safely ignore this email.`;

  return { subject: 'Reset your MedPet password', html, text };
};
