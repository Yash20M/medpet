/** Shared layout/formatting helpers for transactional emails. Inline CSS only
 *  (no external stylesheets, no JS) so templates render consistently across
 *  email clients. */
import { OrderEmailItem } from '../email.types';

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const formatInr = (paise: number): string => `₹${paise.toLocaleString('en-IN')}`;

export const formatDate = (date: Date): string =>
  date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

const STATUS_COLORS: Record<string, string> = {
  success: '#10B981',
  info: '#0EA5E9',
  warning: '#F59E0B',
  danger: '#E11D48',
};

export const shell = (
  heading: string,
  bodyHtml: string,
  opts: { badge?: { label: string; tone?: keyof typeof STATUS_COLORS } } = {}
): string => {
  const badgeHtml = opts.badge
    ? `<div style="display:inline-block;background:${STATUS_COLORS[opts.badge.tone ?? 'info']}1A;
         color:${STATUS_COLORS[opts.badge.tone ?? 'info']};font-weight:700;font-size:12px;
         padding:6px 14px;border-radius:999px;margin-bottom:14px;letter-spacing:0.3px;">
         ${escapeHtml(opts.badge.label)}
       </div>`
    : '';

  return `
  <div style="margin:0;padding:24px;background:#F1F5F4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E2EBE7;">
      <div style="background:linear-gradient(135deg,#10B981,#059669);padding:28px 24px;text-align:center;">
        <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">🐾 MedPet</div>
        <div style="font-size:12px;color:#D1FAE5;margin-top:4px;">Your trusted pet medicine partner</div>
      </div>
      <div style="padding:28px 28px 8px;">
        ${badgeHtml}
        <h1 style="margin:0 0 12px;font-size:20px;color:#0F2A22;">${heading}</h1>
        ${bodyHtml}
      </div>
      <div style="padding:18px 28px 28px;color:#6B8079;font-size:12px;line-height:1.6;border-top:1px solid #EEF3F1;margin-top:12px;">
        Need help? Reach MedPet Support from the app's Support tab, or reply to this email.<br/>
        © ${new Date().getFullYear()} MedPet — Pet care, delivered.
      </div>
    </div>
  </div>
`;
};

export const button = (url: string, label: string): string => `
  <a href="${escapeHtml(url)}" style="display:inline-block;background:#10B981;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:12px;margin:8px 0 16px;">${escapeHtml(label)}</a>
`;

export const itemsTable = (items: OrderEmailItem[]): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
    <thead>
      <tr>
        <td style="padding:8px 0;font-size:12px;color:#6B8079;border-bottom:1px solid #EEF3F1;">Item</td>
        <td style="padding:8px 0;font-size:12px;color:#6B8079;border-bottom:1px solid #EEF3F1;text-align:center;">Qty</td>
        <td style="padding:8px 0;font-size:12px;color:#6B8079;border-bottom:1px solid #EEF3F1;text-align:right;">Price</td>
      </tr>
    </thead>
    <tbody>
      ${items
        .map(
          (item) => `
        <tr>
          <td style="padding:10px 0;font-size:14px;color:#0F2A22;border-bottom:1px solid #F5F8F7;">${escapeHtml(item.name)}</td>
          <td style="padding:10px 0;font-size:14px;color:#334155;text-align:center;border-bottom:1px solid #F5F8F7;">${item.quantity}</td>
          <td style="padding:10px 0;font-size:14px;color:#334155;text-align:right;border-bottom:1px solid #F5F8F7;">${formatInr(item.price * item.quantity)}</td>
        </tr>`
        )
        .join('')}
    </tbody>
  </table>
`;

export const summaryRow = (label: string, value: string, opts: { bold?: boolean } = {}): string => `
  <tr>
    <td style="padding:3px 0;font-size:${opts.bold ? '15px' : '13px'};color:${opts.bold ? '#0F2A22' : '#6B8079'};font-weight:${opts.bold ? '800' : '400'};">${escapeHtml(label)}</td>
    <td style="padding:3px 0;font-size:${opts.bold ? '15px' : '13px'};color:${opts.bold ? '#0F2A22' : '#334155'};font-weight:${opts.bold ? '800' : '400'};text-align:right;">${escapeHtml(value)}</td>
  </tr>
`;

export const paragraph = (html: string): string =>
  `<p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 8px;">${html}</p>`;

export const smallNote = (html: string): string =>
  `<p style="color:#6B8079;font-size:13px;line-height:1.6;margin:12px 0 0;">${html}</p>`;
