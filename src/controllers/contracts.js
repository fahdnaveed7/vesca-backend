const { htmlToPdf } = require('../services/pdf');

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function downloadContractPdf(req, res, next) {
  try {
    const { contract_text, brand_name } = req.body;
    if (!contract_text) return res.status(400).json({ error: 'contract_text is required' });

    const html = buildContractHtml(contract_text, brand_name || 'Brand');
    const pdf = await htmlToPdf(html);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contract-${(brand_name || 'brand').toLowerCase().replace(/\s+/g, '-')}.pdf"`);
    res.send(pdf);
  } catch (err) { next(err); }
}

function buildContractHtml(contractText, brandName) {
  const safeBrandName = esc(brandName);
  const escaped = contractText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = escaped.split('\n');
  const bodyHtml = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '<div style="height:8px"></div>';
    // Title line (all caps, no colon)
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 4 && trimmed.length < 60 && !trimmed.includes(':') && !/[.!?,]$/.test(trimmed)) {
      return `<h1 style="font-size:17px;font-weight:700;color:#1a1a1a;margin:0 0 20px;letter-spacing:-0.01em">${trimmed}</h1>`;
    }
    // Section label (Title Case ending with colon)
    if (trimmed.endsWith(':') && trimmed.length < 40) {
      return `<p style="font-size:10px;font-weight:700;color:#c9a040;text-transform:uppercase;letter-spacing:0.08em;margin:18px 0 4px">${trimmed}</p>`;
    }
    // Signature line
    if (trimmed.startsWith('Creator:') || trimmed.startsWith('Brand:')) {
      return `<p style="font-size:12px;color:#444;margin:6px 0;font-family:monospace">${trimmed}</p>`;
    }
    return `<p style="font-size:13px;color:#333;line-height:1.75;margin:3px 0">${trimmed}</p>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; }
    .page { padding: 52px 60px; }
    .top-bar { background: #c9a040; height: 6px; margin: -52px -60px 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; padding-bottom: 20px; border-bottom: 1px solid #e8e0d0; }
    .header-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #c9a040; margin-bottom: 6px; }
    .header-name { font-size: 20px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.02em; }
    .header-meta { font-size: 11px; color: #888; text-align: right; line-height: 1.8; }
    .sig-section { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e8e0d0; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
    .sig-box { border-top: 1px solid #bbb; padding-top: 8px; font-size: 11px; color: #888; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #f0ece4; display: flex; justify-content: space-between; font-size: 10px; color: #bbb; }
  </style></head><body>
  <div class="page">
    <div class="top-bar"></div>
    <div class="header">
      <div>
        <div class="header-title">Vesca · Partnership Contract</div>
        <div class="header-name">${safeBrandName} Agreement</div>
      </div>
      <div class="header-meta">
        Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}<br/>
        Generated via Vesca
      </div>
    </div>
    <div>${bodyHtml}</div>
    <div class="sig-section">
      <div class="sig-box">Creator Signature &amp; Date</div>
      <div class="sig-box">Brand Representative Signature &amp; Date</div>
    </div>
    <div class="footer">
      <span style="font-weight:700;color:#c9a040">Vesca</span>
      <span>Not legal advice · getvesca.com</span>
    </div>
  </div></body></html>`;
}

module.exports = { downloadContractPdf };
