const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM || 'hello@getvesca.com';

/**
 * Send a plain-text or HTML email.
 */
async function sendEmail({ to, subject, html, text, attachments = [], senderName, replyTo }) {
  const from = senderName ? `${senderName} via Vesca <${FROM}>` : FROM;
  const { data, error } = await resend.emails.send({
    from,
    reply_to: replyTo || undefined,
    to,
    subject,
    html: html || `<pre style="font-family:sans-serif">${text}</pre>`,
    attachments,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
  return data;
}

module.exports = { sendEmail };
