import { EmailBody, OrderEmailData } from '../email.types';
import { shell, paragraph, smallNote, summaryRow, formatInr, escapeHtml } from './shared';

/** Sent the moment a delivery partner accepts an order (status -> 'shipped'). */
export const outForDeliveryEmail = (d: OrderEmailData): EmailBody => {
  const html = shell(
    `Out for delivery, ${escapeHtml(d.customerName)}! 🚚`,
    `${paragraph(`Order <strong>#${d.orderNumber}</strong> is out for delivery.`)}
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 16px;">
       ${summaryRow('Delivery status', 'Out for delivery')}
       ${d.deliveryPartnerName ? summaryRow('Delivery partner', d.deliveryPartnerName) : ''}
       ${d.estimatedDeliveryMinutes ? summaryRow('Estimated arrival', `~${d.estimatedDeliveryMinutes} minutes`) : ''}
       ${summaryRow('Order total', formatInr(d.total))}
     </table>
     ${smallNote('Open the MedPet app and go to your order for a live map of your delivery partner.')}`,
    { badge: { label: 'OUT FOR DELIVERY', tone: 'info' } }
  );

  const text =
    `Order #${d.orderNumber} is out for delivery.\n` +
    (d.deliveryPartnerName ? `Delivery partner: ${d.deliveryPartnerName}\n` : '') +
    (d.estimatedDeliveryMinutes ? `Estimated arrival: ~${d.estimatedDeliveryMinutes} minutes\n` : '') +
    `Order total: ${formatInr(d.total)}\n` +
    `Track live in the MedPet app.\n`;

  return { subject: `Your MedPet Order Is Out for Delivery — #${d.orderNumber}`, html, text };
};
