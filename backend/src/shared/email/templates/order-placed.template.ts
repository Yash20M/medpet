import { EmailBody, OrderEmailData } from '../email.types';
import {
  shell, button, itemsTable, summaryRow, paragraph, smallNote, formatInr, formatDate, escapeHtml,
} from './shared';

export const orderPlacedEmail = (d: OrderEmailData): EmailBody => {
  const paymentStatus = d.paymentMethod === 'cod' ? 'To be paid on delivery' : 'Paid via UPI';
  const eta = d.estimatedDeliveryMinutes
    ? `~${d.estimatedDeliveryMinutes} minutes after your order is dispatched`
    : 'Our team will confirm the delivery window shortly';

  const html = shell(
    `Thanks for your order, ${escapeHtml(d.customerName)}! 🐾`,
    `${paragraph(`Your order <strong>#${d.orderNumber}</strong> placed on ${formatDate(d.orderDate)} has been confirmed.`)}
     ${itemsTable(d.items)}
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 20px;">
       ${summaryRow('Subtotal', formatInr(d.subtotal))}
       ${summaryRow('Delivery fee', d.deliveryFee === 0 ? 'FREE' : formatInr(d.deliveryFee))}
       ${d.discount > 0 ? summaryRow('Discount', `-${formatInr(d.discount)}`) : ''}
       ${summaryRow('Total', formatInr(d.total), { bold: true })}
     </table>
     <p style="color:#0F2A22;font-size:14px;font-weight:700;margin:0 0 4px;">Delivery address</p>
     ${paragraph(escapeHtml(d.deliveryAddress || 'Not provided'))}
     <p style="color:#0F2A22;font-size:14px;font-weight:700;margin:16px 0 4px;">Payment</p>
     ${paragraph(`${d.paymentMethod === 'cod' ? 'Cash on Delivery' : 'UPI'} — ${paymentStatus}`)}
     <p style="color:#0F2A22;font-size:14px;font-weight:700;margin:16px 0 4px;">Estimated delivery</p>
     ${paragraph(eta)}
     ${button(`medpet://orders/${d.orderId}`, 'View order in the app')}
     ${smallNote("We'll email you again as soon as a delivery partner picks up your order.")}`,
    { badge: { label: 'ORDER CONFIRMED', tone: 'success' } }
  );

  const text =
    `Thanks for your order, ${d.customerName}!\n\n` +
    `Order #${d.orderNumber} — ${formatDate(d.orderDate)}\n\n` +
    d.items.map((i) => `${i.quantity} x ${i.name} — ${formatInr(i.price * i.quantity)}`).join('\n') +
    `\n\nSubtotal: ${formatInr(d.subtotal)}\nDelivery fee: ${d.deliveryFee === 0 ? 'FREE' : formatInr(d.deliveryFee)}\n` +
    (d.discount > 0 ? `Discount: -${formatInr(d.discount)}\n` : '') +
    `Total: ${formatInr(d.total)}\n\n` +
    `Delivery address: ${d.deliveryAddress || 'Not provided'}\n` +
    `Payment: ${d.paymentMethod === 'cod' ? 'Cash on Delivery' : 'UPI'} — ${paymentStatus}\n` +
    `Estimated delivery: ${eta}\n`;

  return { subject: `MedPet Order Confirmed — #${d.orderNumber}`, html, text };
};
