const supabase      = require('../services/supabase');
const { ask }       = require('../services/claude');
const prompts       = require('../prompts');

// POST /inbound/email
// Accepts an incoming email payload, uses Claude to extract intent,
// creates/updates a deal, stores the message, and returns a reply suggestion.
async function handleInboundEmail(req, res, next) {
  try {
    const { user_id, from_email, from_name, subject, email_text } = req.body;
    if (!user_id || !email_text) {
      return res.status(400).json({ error: 'user_id and email_text are required' });
    }

    // 1. Analyze email with Claude — returns structured JSON
    const { system: aSystem, user: aUser } = prompts.inboundAnalysis({ emailText: email_text });
    const rawAnalysis = await ask(aSystem, aUser, { maxTokens: 512 });

    let analysis;
    try {
      analysis = JSON.parse(rawAnalysis);
    } catch {
      return res.status(422).json({ error: 'Claude returned unparseable JSON', raw: rawAnalysis });
    }

    const { brand_name, intent, summary, key_details } = analysis;

    // 2. Store the raw message regardless of intent
    const { data: message, error: msgErr } = await supabase
      .from('messages')
      .insert({
        user_id,
        from_email,
        from_name,
        subject,
        body:       email_text,
        direction:  'inbound',
        brand_name,
        intent,
        ai_summary: summary,
      })
      .select()
      .single();
    if (msgErr) throw msgErr;

    // 3. If it's a collab intent — create or find the deal, link the message
    let deal = null;
    if (intent === 'collab') {
      // Try to find an existing deal for this brand
      const { data: existing } = await supabase
        .from('deals')
        .select()
        .eq('user_id', user_id)
        .ilike('brand_name', brand_name)
        .maybeSingle();

      if (existing) {
        deal = existing;
        // Advance status to "replied" if still at "contacted"
        if (deal.status === 'contacted') {
          await supabase
            .from('deals')
            .update({ status: 'replied' })
            .eq('id', deal.id);
          deal.status = 'replied';
        }
      } else {
        const { data: newDeal, error: dealErr } = await supabase
          .from('deals')
          .insert({ user_id, brand_name, status: 'replied' })
          .select()
          .single();
        if (dealErr) throw dealErr;
        deal = newDeal;
      }

      // Link message to deal
      await supabase
        .from('messages')
        .update({ deal_id: deal.id })
        .eq('id', message.id);
    }

    // 4. Generate a reply suggestion
    const { system: rSystem, user: rUser } = prompts.replySuggestion({
      brand: brand_name,
      emailText: email_text,
    });
    const replySuggestion = await ask(rSystem, rUser, { maxTokens: 512 });

    res.json({
      analysis,
      deal,
      message,
      reply_suggestion: replySuggestion,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { handleInboundEmail };
