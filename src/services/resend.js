const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM || 'deals@vesca.io';

/**
 * Send a plain-text or HTML email.
 */
async function sendEmail({ to, subject, html, text, attachments = [] }) {
  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html: html || `<pre>${text}</pre>`,
    attachments, // [{ filename, content (base64 string) }]
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
  return data;
}

module.exports = { sendEmail };
