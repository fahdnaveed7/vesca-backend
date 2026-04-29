const supabase        = require('../services/supabase');
const { ask }         = require('../services/claude');
const { htmlToPdf }   = require('../services/pdf');
const { sendEmail }   = require('../services/resend');
const prompts         = require('../prompts');

// POST /proposal/generate
// Uses Claude to write a proposal, saves it to DB.
async function generateProposal(req, res, next) {
  try {
    const { deal_id, deliverables, price, timeline } = req.body;
    if (!deliverables || !price || !timeline) {
      return res.status(400).json({ error: 'deliverables, price, timeline are required' });
    }

    // Fetch deal — support lookup by UUID or brand name
    const isUuid = /^[0-9a-f-]{36}$/i.test(deal_id);
    let dealQuery = supabase.from('deals').select('*, users(name)');
    dealQuery = isUuid
      ? dealQuery.eq('id', deal_id)
      : dealQuery.ilike('brand_name', deal_id);
    const { data: deal, error: dealErr } = await dealQuery.maybeSingle();

    if (dealErr) throw dealErr;

    const brandName = deal?.brand_name || deal_id || 'Brand';
    const creatorName = deal?.users?.name || 'Creator';
    const userId = deal?.user_id || '00000000-0000-0000-0000-000000000001';

    // Auto-create a deal if brand name was given but no deal exists
    let resolvedDealId = deal?.id || null;
    if (!resolvedDealId && brandName) {
      const { data: newDeal } = await supabase
        .from('deals')
        .insert({ user_id: userId, brand_name: brandName, status: 'negotiating' })
        .select()
        .single();
      resolvedDealId = newDeal?.id || null;
    }

    const { system, user } = prompts.proposalText({
      brand:        brandName,
      deliverables,
      price,
      timeline,
      creatorName,
    });
    const proposalText = await ask(system, user, { maxTokens: 2048 });

    // Build HTML for PDF rendering later
    const proposalHtml = markdownToHtml(proposalText, brandName, price);

    const { data: proposal, error: propErr } = await supabase
      .from('proposals')
      .insert({
        deal_id:       resolvedDealId,
        user_id:       userId,
        deliverables,
        price,
        timeline,
        proposal_text: proposalText,
        proposal_html: proposalHtml,
        status:        'draft',
      })
      .select()
      .single();
    if (propErr) throw propErr;

    res.status(201).json(proposal);
  } catch (err) {
    next(err);
  }
}

// POST /proposal/pdf
// Converts a saved proposal's HTML to PDF and returns it as a binary download.
async function generatePdf(req, res, next) {
  try {
    const { proposal_id } = req.body;
    if (!proposal_id) return res.status(400).json({ error: 'proposal_id is required' });

    const { data: proposal, error } = await supabase
      .from('proposals')
      .select()
      .eq('id', proposal_id)
      .single();
    if (error) throw error;

    const pdfBuffer = await htmlToPdf(proposal.proposal_html);

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="proposal-${proposal_id}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

// POST /proposal/send
// Generates PDF, emails it to the brand, and advances deal status to "negotiating".
async function sendProposal(req, res, next) {
  try {
    const { proposal_id, to_email } = req.body;
    if (!proposal_id || !to_email) {
      return res.status(400).json({ error: 'proposal_id and to_email are required' });
    }

    const { data: proposal, error: propErr } = await supabase
      .from('proposals')
      .select('*, deals(brand_name)')
      .eq('id', proposal_id)
      .single();
    if (propErr) throw propErr;

    const pdfBuffer = await htmlToPdf(proposal.proposal_html);

    await sendEmail({
      to:      to_email,
      subject: `Partnership Proposal — ${proposal.deals.brand_name}`,
      html:    '<p>Please find our partnership proposal attached. We look forward to working together!</p>',
      attachments: [{
        filename: 'proposal.pdf',
        content:  pdfBuffer.toString('base64'),
      }],
    });

    // Advance deal status
    await supabase
      .from('deals')
      .update({ status: 'negotiating' })
      .eq('id', proposal.deal_id);

    // Mark proposal as sent
    await supabase
      .from('proposals')
      .update({ status: 'sent' })
      .eq('id', proposal_id);

    res.json({ message: 'Proposal sent', proposal_id, to_email });
  } catch (err) {
    next(err);
  }
}

// Minimal markdown → HTML for PDF rendering
function markdownToHtml(markdown, brandName, price) {
  const body = markdown
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Georgia, serif; max-width: 720px; margin: 60px auto; color: #1a1a1a; line-height: 1.7; }
  h1 { font-size: 28px; border-bottom: 2px solid #000; padding-bottom: 8px; }
  h2 { font-size: 20px; margin-top: 32px; color: #333; }
  .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .price-badge { background: #000; color: #fff; padding: 8px 20px; border-radius: 4px; font-size: 22px; font-weight: bold; }
</style>
</head>
<body>
  <div class="header">
    <div><strong>Vesca</strong> — Creator Partnership Proposal</div>
    <div class="price-badge">$${price}</div>
  </div>
  <h1>Proposal for ${brandName}</h1>
  ${body}
</body>
</html>`;
}

module.exports = { generateProposal, generatePdf, sendProposal };
