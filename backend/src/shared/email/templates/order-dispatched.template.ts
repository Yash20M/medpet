import { EmailBody, OrderEmailData } from '../email.types';
import { shell, paragraph, smallNote, summaryRow, formatInr, escapeHtml } from './shared';

/**
 * Built for architectural completeness (EmailService.sendOrderDispatchedEmail)
 * but NOT wired to an automatic trigger today: MedPet's order lifecycle has a
 * single 'confirmed' -> 'shipped' transition that means "a delivery partner
 * picked this order up and is on the way" — there is no separate warehouse
 * "packed/dispatched" stage distinct from that. That transition sends
 * OUT_FOR_DELIVERY (see out-for-delivery.template.ts) instead. Kept here so a
 * future distinct dispatch stage can use it without inventing a new template.
 */
export const orderDispatchedEmail = (d: OrderEmailData): EmailBody => {
  const html = shell(
    `Your order is on its way, ${escapeHtml(d.customerName)}! 📦`,
    `${paragraph(`Order <strong>#${d.orderNumber}</strong> has been dispatched.`)}
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 16px;">
       ${summaryRow('Order status', 'Dispatched')}
       ${d.deliveryPartnerName ? summaryRow('Delivery partner', d.deliveryPartnerName) : ''}
       ${d.estimatedDeliveryMinutes ? summaryRow('Estimated delivery', `~${d.estimatedDeliveryMinutes} minutes`) : ''}
       ${summaryRow('Order total', formatInr(d.total))}
     </table>
     ${smallNote('Track live progress from the Orders tab in the MedPet app.')}`,
    { badge: { label: 'ORDER DISPATCHED', tone: 'info' } }
  );

  const text =
    `Order #${d.orderNumber} has been dispatched.\n` +
    (d.deliveryPartnerName ? `Delivery partner: ${d.deliveryPartnerName}\n` : '') +
    (d.estimatedDeliveryMinutes ? `Estimated delivery: ~${d.estimatedDeliveryMinutes} minutes\n` : '') +
    `Order total: ${formatInr(d.total)}\n`;

  return { subject: `Your MedPet Order Has Been Dispatched — #${d.orderNumber}`, html, text };
};
