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

// Convert a string to Title Case
function toTitleCase(str) {
  const lower = str.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// Convert ALL CAPS text to sentence case (preserve proper nouns heuristically)
function fixCaps(text) {
  // If more than 60% of alpha chars are uppercase, convert to sentence case word by word
  const alpha = text.replace(/[^a-zA-Z]/g, '');
  if (!alpha.length) return text;
  const upperRatio = (text.match(/[A-Z]/g) || []).length / alpha.length;
  if (upperRatio < 0.6) return text; // already mixed case, leave alone
  // Sentence-case: lowercase everything, capitalize first letter of each sentence
  return text.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, c => c.toUpperCase());
}

// Apply inline markdown: **bold**, *em*, strip leftover ** markers
function applyInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
    .replace(/\*\*/g, '') // strip any orphaned **
    .replace(/\n/g, ' ');
}

const SECTION_LABELS = ['OVERVIEW', 'DELIVERABLES', 'TIMELINE', 'PRICING', 'NEXT STEPS', 'TERMS', 'ABOUT'];

// Markdown → clean HTML for PDF rendering
function markdownToHtml(markdown, brandName, price) {
  // Split into blocks, convert each
  const blocks = markdown.split(/\n{2,}/);
  const body = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';

    // ## or # headings
    if (/^## (.+)/.test(trimmed)) {
      const label = trimmed.replace(/^## /, '').replace(/\*\*/g, '');
      return `<h2>${toTitleCase(label)}</h2>`;
    }
    if (/^# (.+)/.test(trimmed)) {
      const label = trimmed.replace(/^# /, '').replace(/\*\*/g, '');
      return `<h2>${toTitleCase(label)}</h2>`;
    }

    // ALL-CAPS section label embedded at start of paragraph (old AI format)
    // e.g. "OVERVIEW We are excited to propose..."
    const embeddedLabel = SECTION_LABELS.find(lbl => trimmed.toUpperCase().startsWith(lbl + ' ') || trimmed.toUpperCase().startsWith(lbl + ':'));
    if (embeddedLabel) {
      const afterLabel = trimmed.slice(embeddedLabel.length).replace(/^[:\s]+/, '');
      const bodyText = fixCaps(afterLabel);
      return `<h2>${toTitleCase(embeddedLabel)}</h2><p>${applyInline(bodyText)}</p>`;
    }

    // Standalone ALL-CAPS label on its own line
    if (/^[A-Z][A-Z\s]{2,}$/.test(trimmed) && trimmed.length < 40 && !trimmed.includes('.')) {
      return `<h2>${toTitleCase(trimmed)}</h2>`;
    }

    // List blocks — may contain mixed bullet styles and inline **bold**
    if (/^[-*•] /m.test(trimmed) || /^\d+\. /m.test(trimmed)) {
      const lines = trimmed.split('\n').filter(l => /^[-*•] |^\d+\. /.test(l.trim()));
      if (lines.length) {
        const items = lines.map(l => {
          const text = l.trim().replace(/^[-*•] /, '').replace(/^\d+\. /, '');
          return `<li>${applyInline(fixCaps(text))}</li>`;
        }).join('');
        return `<ul>${items}</ul>`;
      }
    }

    // Paragraph with mixed list items (e.g. "- **Week 1**: ..." embedded in prose)
    if (trimmed.includes(' - ') || trimmed.includes('\n- ')) {
      // Split on inline dashes that look like list items
      const parts = trimmed.split(/\n?- \*\*|\n- /);
      if (parts.length > 1) {
        const intro = parts[0].trim();
        const items = parts.slice(1).map(p => `<li>${applyInline(fixCaps('**' + p.trim()))}</li>`).join('');
        return (intro ? `<p>${applyInline(fixCaps(intro))}</p>` : '') + `<ul>${items}</ul>`;
      }
    }

    // Regular paragraph
    const inline = applyInline(fixCaps(trimmed));
    return `<p>${inline}</p>`;
  }).join('');

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    background: #fff;
    color: #1a1a1a;
    font-size: 14px;
    line-height: 1.7;
  }

  /* ── Top amber bar ── */
  .top-bar {
    background: #c9a040;
    height: 5px;
    width: 100%;
    display: block;
  }

  /* ── Page wrapper ── */
  .page {
    padding: 48px 64px 64px;
    max-width: 794px;
    margin: 0 auto;
  }

  /* ── Header ── */
  .header {
    display: table;
    width: 100%;
    margin-bottom: 40px;
    padding-bottom: 28px;
    border-bottom: 1px solid #e8e0d0;
  }
  .header-left  { display: table-cell; vertical-align: middle; }
  .header-right { display: table-cell; vertical-align: middle; text-align: right; }

  .wordmark {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #c9a040;
  }
  .wordmark-sub {
    font-size: 11px;
    color: #888;
    font-weight: 400;
    margin-top: 2px;
    letter-spacing: 0;
    text-transform: none;
  }

  .date-label {
    font-size: 11px;
    color: #999;
    text-align: right;
  }

  /* ── Title block ── */
  .title-block {
    margin-bottom: 32px;
  }
  .title-brand {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #c9a040;
    margin-bottom: 6px;
  }
  .title-main {
    font-size: 28px;
    font-weight: 800;
    color: #1a1a1a;
    letter-spacing: -0.02em;
    line-height: 1.15;
  }

  /* ── Price callout ── */
  .price-row {
    display: table;
    width: 100%;
    margin-bottom: 36px;
  }
  .price-box {
    display: table-cell;
    background: #fdf8ee;
    border-left: 3px solid #c9a040;
    padding: 16px 24px;
    vertical-align: middle;
  }
  .price-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #a07830;
    margin-bottom: 4px;
  }
  .price-amount {
    font-size: 30px;
    font-weight: 900;
    color: #1a1a1a;
    letter-spacing: -0.03em;
  }

  /* ── Content ── */
  h2 {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #c9a040;
    margin-top: 32px;
    margin-bottom: 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e8e0d0;
  }

  p {
    font-size: 14px;
    color: #374151;
    margin-bottom: 14px;
    line-height: 1.75;
  }

  ul {
    margin: 0 0 16px 0;
    padding-left: 0;
    list-style: none;
  }

  li {
    font-size: 14px;
    color: #374151;
    padding: 5px 0 5px 18px;
    position: relative;
    line-height: 1.6;
    border-bottom: 1px solid #f4f0e8;
  }
  li:last-child { border-bottom: none; }
  li::before {
    content: '—';
    position: absolute;
    left: 0;
    color: #c9a040;
    font-weight: 700;
  }

  strong { color: #1a1a1a; font-weight: 600; }

  /* ── Footer ── */
  .footer {
    margin-top: 56px;
    padding-top: 20px;
    border-top: 1px solid #e8e0d0;
    display: table;
    width: 100%;
  }
  .footer-left  { display: table-cell; vertical-align: middle; }
  .footer-right { display: table-cell; vertical-align: middle; text-align: right; }
  .footer-text  { font-size: 11px; color: #bbb; }
  .footer-brand { font-size: 11px; font-weight: 700; color: #c9a040; letter-spacing: 0.06em; text-transform: uppercase; }
</style>
</head>
<body>

  <div class="top-bar"></div>

  <div class="page">

    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <div class="wordmark">Vesca</div>
        <div class="wordmark-sub">Creator Partnership Proposal</div>
      </div>
      <div class="header-right">
        <div class="date-label">${today}</div>
      </div>
    </div>

    <!-- Title -->
    <div class="title-block">
      <div class="title-brand">Prepared for ${brandName}</div>
      <div class="title-main">Partnership Proposal</div>
    </div>

    <!-- Price callout -->
    <div class="price-row">
      <div class="price-box">
        <div class="price-label">Proposed investment</div>
        <div class="price-amount">$${Number(price).toLocaleString()}</div>
      </div>
    </div>

    <!-- Proposal body -->
    ${body}

    <!-- Footer -->
    <div class="footer">
      <div class="footer-left">
        <div class="footer-text">Created with Vesca · getvesca.com</div>
      </div>
      <div class="footer-right">
        <div class="footer-brand">Vesca</div>
      </div>
    </div>

  </div>

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
