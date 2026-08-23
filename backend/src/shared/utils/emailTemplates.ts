/** HTML/text builders for transactional emails. Kept dependency-free and inline
 *  so they render fine in any client. Each returns { subject, html, text }. */

interface EmailBody {
  subject: string;
  html: string;
  text: string;
}

const shell = (heading: string, bodyHtml: string): string => `
  <div style="margin:0;padding:24px;background:#F1F5F4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E2EBE7;">
      <div style="background:linear-gradient(135deg,#10B981,#059669);padding:28px 24px;text-align:center;">
        <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">🐾 MedPet</div>
      </div>
      <div style="padding:28px 28px 8px;">
        <h1 style="margin:0 0 12px;font-size:20px;color:#0F2A22;">${heading}</h1>
        ${bodyHtml}
      </div>
      <div style="padding:18px 28px 28px;color:#6B8079;font-size:12px;line-height:1.6;">
        If you weren't expecting this email you can safely ignore it.<br/>
        © MedPet — Pet care, delivered.
      </div>
    </div>
  </div>
`;

const button = (url: string, label: string): string => `
  <a href="${url}" style="display:inline-block;background:#10B981;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:12px;margin:8px 0 16px;">${label}</a>
`;

/** Sent when an admin adds a new delivery partner — invites them to set a password. */
export const invitePartnerEmail = (name: string, url: string): EmailBody => ({
  subject: 'You have been added as a MedPet delivery partner',
  html: shell(
    `Welcome aboard, ${name}! 🚚`,
    `<p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 8px;">
       You've been added as a <strong>delivery partner</strong> on MedPet. To start
       accepting deliveries, set your password using the button below.
     </p>
     ${button(url, 'Set your password')}
     <p style="color:#6B8079;font-size:13px;line-height:1.6;margin:0 0 4px;">
       Or copy this link into your browser:<br/>
       <a href="${url}" style="color:#059669;word-break:break-all;">${url}</a>
     </p>
     <p style="color:#6B8079;font-size:13px;margin:12px 0 0;">This link expires in 3 days.</p>`
  ),
  text:
    `Welcome to MedPet, ${name}!\n\n` +
    `You've been added as a delivery partner. Set your password here:\n${url}\n\n` +
    `This link expires in 3 days.`,
});

/** Sent for a self-service "forgot password" request. */
export const resetPasswordEmail = (name: string, url: string): EmailBody => ({
  subject: 'Reset your MedPet password',
  html: shell(
    `Hi ${name},`,
    `<p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 8px;">
       We received a request to reset your password. Click below to choose a new one.
     </p>
     ${button(url, 'Reset password')}
     <p style="color:#6B8079;font-size:13px;line-height:1.6;margin:0 0 4px;">
       Or copy this link into your browser:<br/>
       <a href="${url}" style="color:#059669;word-break:break-all;">${url}</a>
     </p>
     <p style="color:#6B8079;font-size:13px;margin:12px 0 0;">This link expires in 3 days.</p>`
  ),
  text:
    `Hi ${name},\n\nReset your MedPet password here:\n${url}\n\nThis link expires in 3 days.`,
});
