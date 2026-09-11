import { EmailBody, OrderEmailData } from '../email.types';
import { shell, paragraph, smallNote, summaryRow, formatInr, escapeHtml } from './shared';

export const orderAcceptedEmail = (d: OrderEmailData): EmailBody => {
  const eta = d.estimatedDeliveryMinutes
    ? `~${d.estimatedDeliveryMinutes} minutes`
    : 'shortly — we will notify you once a delivery partner is on the way';

  const html = shell(
    `Good news, ${escapeHtml(d.customerName)}! 🎉`,
    `${paragraph(`Your order <strong>#${d.orderNumber}</strong> has been accepted and is being prepared.`)}
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 16px;">
       ${summaryRow('Order status', 'Accepted')}
       ${summaryRow('Estimated delivery', eta)}
       ${summaryRow('Order total', formatInr(d.total), { bold: true })}
     </table>
     <p style="color:#0F2A22;font-size:14px;font-weight:700;margin:0 0 4px;">Delivery address</p>
     ${paragraph(escapeHtml(d.deliveryAddress || 'Not provided'))}
     ${smallNote("We'll let you know the moment your order is out for delivery.")}`,
    { badge: { label: 'ORDER ACCEPTED', tone: 'success' } }
  );

  const text =
    `Good news, ${d.customerName}!\n\nOrder #${d.orderNumber} has been accepted and is being prepared.\n` +
    `Estimated delivery: ${eta}\nOrder total: ${formatInr(d.total)}\n` +
    `Delivery address: ${d.deliveryAddress || 'Not provided'}\n`;

  return { subject: `MedPet Order Accepted — #${d.orderNumber}`, html, text };
};
