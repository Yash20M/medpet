import { EmailBody, OrderEmailData } from '../email.types';
import { shell, button, itemsTable, paragraph, smallNote, summaryRow, formatInr, formatDate, escapeHtml } from './shared';

export const orderDeliveredEmail = (d: OrderEmailData): EmailBody => {
  const deliveredAt = d.deliveredAt ?? new Date();

  const html = shell(
    `Delivered! Enjoy, ${escapeHtml(d.customerName)} 🐾`,
    `${paragraph(`Order <strong>#${d.orderNumber}</strong> was delivered on ${formatDate(deliveredAt)}.`)}
     ${itemsTable(d.items)}
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 16px;">
       ${summaryRow('Order total', formatInr(d.total), { bold: true })}
     </table>
     ${button(`medpet://orders/${d.orderId}/review`, 'Rate your order')}
     ${smallNote('Thanks for shopping with MedPet — questions about this order? Contact Support from the app.')}`,
    { badge: { label: 'ORDER DELIVERED', tone: 'success' } }
  );

  const text =
    `Order #${d.orderNumber} was delivered on ${formatDate(deliveredAt)}.\n\n` +
    d.items.map((i) => `${i.quantity} x ${i.name} — ${formatInr(i.price * i.quantity)}`).join('\n') +
    `\n\nOrder total: ${formatInr(d.total)}\nThanks for shopping with MedPet!\n`;

  return { subject: `MedPet Order Delivered — #${d.orderNumber}`, html, text };
};
