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
  const bodyHtml = emailBody
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid #f0f0f0;">
            <span style="font-size:13px;font-weight:700;letter-spacing:0.08em;color:#8B5CF6;text-transform:uppercase;">Vesca</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;color:#1a1a1a;font-size:15px;line-height:1.75;">
            <p>${bodyHtml}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 32px;color:#888;font-size:12px;border-top:1px solid #f0f0f0;">
            Sent by <strong>${senderName}</strong> via <a href="https://getvesca.com" style="color:#8B5CF6;text-decoration:none;">Vesca</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

module.exports = { generateOutreach, sendOutreach };
