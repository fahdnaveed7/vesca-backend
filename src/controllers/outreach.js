const supabase    = require('../services/supabase');
const { ask }     = require('../services/claude');
const { sendEmail } = require('../services/resend');
const prompts     = require('../prompts');

// POST /outreach/generate
// Returns an AI-drafted cold email. Does not send or save anything yet.
async function generateOutreach(req, res, next) {
  try {
    const brand = req.body.brand || req.body.brand_name;
    const niche = req.body.niche || req.body.your_niche;
    const pitch = req.body.pitch || req.body.key_pitch;
    if (!brand || !niche || !pitch) {
      return res.status(400).json({ error: 'brand, niche, and pitch are required' });
    }

    const { system, user } = prompts.outreachEmail({ brand, niche, pitch });
    const emailBody = await ask(system, user);

    res.json({ email_body: emailBody });
  } catch (err) {
    next(err);
  }
}

// POST /outreach/send
// Generates email, sends it via Resend, saves outreach + creates deal in DB.
async function sendOutreach(req, res, next) {
  try {
    const { brand, niche, pitch, to_email } = req.body;
    const user_id = req.user.id;
    if (!brand || !niche || !pitch || !to_email) {
      return res.status(400).json({ error: 'brand, niche, pitch, to_email are required' });
    }

    // 1. Fetch sender profile
    const { data: profile } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', user_id)
      .single();
    const senderName  = profile?.name  || 'Creator';
    const senderEmail = profile?.email || req.user.email;

    // 2. Generate email body with AI
    const { system, user } = prompts.outreachEmail({ brand, niche, pitch });
    const emailBody = await ask(system, user);

    // 3. Send via Resend — appears as creator, replies go to their inbox
    await sendEmail({
      to:          to_email,
      subject:     `Partnership opportunity — ${brand}`,
      html:        outreachTemplate({ senderName, emailBody }),
      senderName,
      replyTo:     senderEmail,
    });

    // 3. Create deal with status = "contacted"
    const { data: deal, error: dealErr } = await supabase
      .from('deals')
      .insert({ user_id, brand_name: brand, status: 'contacted' })
      .select()
      .single();
    if (dealErr) throw dealErr;

    // 4. Save outreach record
    const { data: outreach, error: outErr } = await supabase
      .from('outreach')
      .insert({
        user_id,
        deal_id:    deal.id,
        brand_name: brand,
        to_email,
        email_body: emailBody,
        status:     'sent',
      })
      .select()
      .single();
    if (outErr) throw outErr;

    res.status(201).json({ outreach, deal });
  } catch (err) {
    next(err);
  }
}

function outreachTemplate({ senderName, emailBody }) {
  // Convert plain-text paragraphs/newlines to HTML (no HTML-escaping — body is AI-generated plain text)
  const bodyHtml = emailBody
    .replace(/\n\n/g, '</p><p style="color:#374151;font-size:15px;line-height:1.75;margin:0 0 16px;">')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @media only screen and (max-width:600px) {
      .outer { padding: 16px 0 !important; }
      .card  { width: 100% !important; border-radius: 0 !important; }
      .body  { padding: 28px 24px !important; }
      .foot  { padding: 16px 24px !important; }
      .logo  { padding: 24px 24px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <!-- preheader -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f4f4f8;">
    Partnership opportunity from ${senderName} — a quick message just for you.
  </div>

  <table class="outer" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 0;">
    <tr><td align="center">
      <table class="card" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Purple top accent bar -->
        <tr><td style="background:#7C3AED;height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- Logo row -->
        <tr>
          <td class="logo" style="padding:28px 40px 20px;border-bottom:1px solid #F3F4F6;">
            <span style="font-size:13px;font-weight:800;letter-spacing:0.1em;color:#7C3AED;text-transform:uppercase;">Vesca</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td class="body" style="padding:32px 40px 28px;">
            <p style="color:#374151;font-size:15px;line-height:1.75;margin:0 0 16px;">${bodyHtml}</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td class="foot" style="padding:16px 40px 24px;border-top:1px solid #F3F4F6;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;">
              Sent by <strong style="color:#6B7280;">${senderName}</strong> via
              <a href="https://getvesca.com" style="color:#7C3AED;text-decoration:none;">Vesca</a>.
              This message was sent on behalf of ${senderName} and reflects their own communication.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

module.exports = { generateOutreach, sendOutreach };
