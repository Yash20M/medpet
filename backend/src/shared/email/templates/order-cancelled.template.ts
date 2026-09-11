import { EmailBody, OrderEmailData } from '../email.types';
import { shell, paragraph, smallNote, summaryRow, formatInr, escapeHtml } from './shared';

/** Sent when an already-accepted order is cancelled (by the customer or an admin). */
export const orderCancelledEmail = (d: OrderEmailData): EmailBody => {
  const refundLine =
    d.paymentMethod === 'upi'
      ? `A refund of ${formatInr(d.total)} will be credited to your original payment method within 5–7 business days.`
      : 'This order was Cash on Delivery — no payment was collected, so there is nothing to refund.';

  const html = shell(
    `Hi ${escapeHtml(d.customerName)},`,
    `${paragraph(`Your order <strong>#${d.orderNumber}</strong> has been cancelled.`)}
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 16px;">
       ${summaryRow('Order status', 'Cancelled')}
       ${d.statusReason ? summaryRow('Reason', d.statusReason) : ''}
       ${summaryRow('Payment method', d.paymentMethod === 'cod' ? 'Cash on Delivery' : 'UPI')}
       ${summaryRow('Order total', formatInr(d.total), { bold: true })}
     </table>
     ${paragraph(refundLine)}
     ${smallNote('You can place a new order any time from the MedPet app.')}`,
    { badge: { label: 'ORDER CANCELLED', tone: 'danger' } }
  );

  const text =
    `Hi ${d.customerName},\n\nYour order #${d.orderNumber} has been cancelled.\n` +
    (d.statusReason ? `Reason: ${d.statusReason}\n` : '') +
    `Payment method: ${d.paymentMethod === 'cod' ? 'Cash on Delivery' : 'UPI'}\n` +
    `Order total: ${formatInr(d.total)}\n${refundLine}\n`;

  return { subject: `MedPet Order Cancelled — #${d.orderNumber}`, html, text };
};
