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
    let dealQuery = supabase.from('deals').select('*, users(name)').eq('user_id', req.user.id);
    dealQuery = isUuid
      ? dealQuery.eq('id', deal_id)
      : dealQuery.ilike('brand_name', deal_id);
    const { data: deal, error: dealErr } = await dealQuery.maybeSingle();

    if (dealErr) throw dealErr;

    const brandName = deal?.brand_name || deal_id || 'Brand';
    const creatorName = deal?.users?.name || 'Creator';
    const userId = req.user.id;

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
        user_id:       req.user.id,
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

    // Fetch sender profile
    const { data: profile } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', req.user.id)
      .single();
    const senderName  = profile?.name  || 'Creator';
    const senderEmail = profile?.email || req.user.email;
    const brandName   = proposal.deals?.brand_name || 'Brand';

    await sendEmail({
      to:          to_email,
      subject:     `Partnership Proposal — ${brandName}`,
      html:        proposalEmailTemplate({ senderName, brandName, price: proposal.price }),
      senderName,
      replyTo:     senderEmail,
      attachments: [{
        filename: `proposal-${brandName.toLowerCase().replace(/\s+/g, '-')}.pdf`,
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
    .replace(/^\* (.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul style="padding-left:20px;margin:12px 0;">${m}</ul>`)
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 720px; margin: 0 auto; color: #1a1a1a; line-height: 1.75; padding: 0 40px 60px; }
  .top-bar { background: #7C3AED; height: 4px; margin: 0 -40px 48px; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1px solid #E9D5FF; }
  .wordmark { font-size: 15px; font-weight: 800; color: #7C3AED; letter-spacing: 0.06em; text-transform: uppercase; }
  .wordmark span { color: #1a1a1a; font-weight: 400; font-size: 13px; margin-left: 8px; }
  .price-badge { background: #7C3AED; color: #fff; padding: 10px 22px; border-radius: 8px; font-size: 22px; font-weight: 800; box-shadow: 0 2px 12px rgba(124,58,237,0.35); }
  h1 { font-size: 28px; font-weight: 800; border-bottom: 2px solid #7C3AED; padding-bottom: 10px; margin-bottom: 28px; color: #1a1a1a; }
  h2 { font-size: 18px; font-weight: 700; margin-top: 36px; margin-bottom: 8px; color: #4C1D95; }
  p { margin: 0 0 16px; font-size: 15px; color: #374151; }
  ul { color: #374151; font-size: 15px; }
  li { margin-bottom: 6px; }
  strong { color: #1a1a1a; }
</style>
</head>
<body>
  <div class="top-bar"></div>
  <div class="header">
    <div class="wordmark">Vesca <span>Creator Partnership Proposal</span></div>
    <div class="price-badge">$${price}</div>
  </div>
  <h1>Proposal for ${brandName}</h1>
  ${body}
</body>
</html>`;
}

function proposalEmailTemplate({ senderName, brandName, price }) {
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
    ${senderName} sent you a partnership proposal — $${price} · PDF attached
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
          <td class="body" style="padding:36px 40px 32px;">
            <h1 style="margin:0 0 6px;font-size:22px;color:#1a1a1a;font-weight:800;">Partnership Proposal</h1>
            <p style="margin:0 0 28px;color:#6B7280;font-size:14px;">From <strong style="color:#374151;">${senderName}</strong> · For <strong style="color:#374151;">${brandName}</strong></p>

            <!-- Price callout -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#F5F3FF;border-left:3px solid #7C3AED;border-radius:0 6px 6px 0;padding:16px 20px;">
                  <p style="margin:0;font-size:11px;color:#6D28D9;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Proposed Value</p>
                  <p style="margin:6px 0 0;font-size:28px;font-weight:900;color:#4C1D95;">$${price}</p>
                </td>
              </tr>
            </table>

            <p style="color:#374151;font-size:15px;line-height:1.75;margin:0 0 16px;">Hi there,</p>
            <p style="color:#374151;font-size:15px;line-height:1.75;margin:0 0 16px;">
              I've put together a partnership proposal for <strong>${brandName}</strong>. Please find the full details in the attached PDF — it covers deliverables, timeline, and pricing.
            </p>
            <p style="color:#374151;font-size:15px;line-height:1.75;margin:0 0 32px;">
              I'd love to discuss this further. Feel free to reply directly to this email and we can go from there.
            </p>

            <p style="color:#374151;font-size:15px;line-height:1.75;margin:0;">
              Best,<br>
              <strong style="color:#1a1a1a;">${senderName}</strong>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td class="foot" style="padding:16px 40px 24px;border-top:1px solid #F3F4F6;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;">
              Sent via <a href="https://getvesca.com" style="color:#7C3AED;text-decoration:none;">Vesca</a> — Creator Deal Management.
              This is a transactional email sent on behalf of ${senderName}.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

module.exports = { generateProposal, generatePdf, sendProposal };
