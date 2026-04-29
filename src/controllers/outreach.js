const supabase    = require('../services/supabase');
const { ask }     = require('../services/claude');
const { sendEmail } = require('../services/resend');
const prompts     = require('../prompts');

// POST /outreach/generate
// Returns an AI-drafted cold email. Does not send or save anything yet.
async function generateOutreach(req, res, next) {
  try {
    const { brand, niche, pitch } = req.body;
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
    const { user_id, brand, niche, pitch, to_email } = req.body;
    if (!user_id || !brand || !niche || !pitch || !to_email) {
      return res.status(400).json({ error: 'user_id, brand, niche, pitch, to_email are required' });
    }

    // 1. Generate email with Claude
    const { system, user } = prompts.outreachEmail({ brand, niche, pitch });
    const emailBody = await ask(system, user);

    // 2. Send via Resend
    await sendEmail({
      to: to_email,
      subject: `Partnership opportunity — ${brand}`,
      text: emailBody,
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

module.exports = { generateOutreach, sendOutreach };
