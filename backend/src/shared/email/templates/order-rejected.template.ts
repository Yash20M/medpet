import { EmailBody, OrderEmailData } from '../email.types';
import { shell, paragraph, smallNote, summaryRow, formatInr, escapeHtml } from './shared';

/** Sent when an order is called off before it was ever accepted/paid out —
 *  i.e. it never reached the delivery queue. No admin-only detail is exposed. */
export const orderRejectedEmail = (d: OrderEmailData): EmailBody => {
  const refundLine =
    d.paymentMethod === 'upi'
      ? 'Any payment already made will be refunded to your original payment method within 5–7 business days.'
      : 'No payment was collected for this order — there is nothing to refund.';

  const html = shell(
    `Hi ${escapeHtml(d.customerName)},`,
    `${paragraph(`We're sorry — your order <strong>#${d.orderNumber}</strong> could not be accepted.`)}
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 16px;">
       ${summaryRow('Order status', 'Rejected')}
       ${d.statusReason ? summaryRow('Reason', d.statusReason) : ''}
       ${summaryRow('Order total', formatInr(d.total))}
     </table>
     ${paragraph(refundLine)}
     ${smallNote('If you have questions about this order, reach out to MedPet Support and reference your order number.')}`,
    { badge: { label: 'ORDER REJECTED', tone: 'danger' } }
  );

  const text =
    `Hi ${d.customerName},\n\nYour order #${d.orderNumber} could not be accepted.\n` +
    (d.statusReason ? `Reason: ${d.statusReason}\n` : '') +
    `Order total: ${formatInr(d.total)}\n${refundLine}\n`;

  return { subject: `MedPet Order Rejected — #${d.orderNumber}`, html, text };
};
