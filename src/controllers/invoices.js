const supabase = require('../services/supabase');
const { htmlToPdf } = require('../services/pdf');

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function generateInvoice(req, res, next) {
  try {
    const { deal_id } = req.body;
    const user_id = req.user.id;

    if (!deal_id) return res.status(400).json({ error: 'deal_id is required' });

    const { data: deal, error } = await supabase
      .from('deals')
      .select('*')
      .eq('id', deal_id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (error) throw error;
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    const invoiceNumber = 'INV-' + Date.now().toString().slice(-6);
    const dueDate = new Date(Date.now() + 30 * 86400000)
      .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const invoice = {
      invoice_number: invoiceNumber,
      deal_id: deal.id,
      brand_name: deal.brand_name,
      amount: deal.amount ?? 0,
      description: deal.notes || 'Brand Partnership Services',
      due_date: dueDate,
      created_at: new Date().toISOString(),
    };

    res.json(invoice);
  } catch (err) { next(err); }
}

async function downloadInvoicePdf(req, res, next) {
  try {
    const { deal_id, invoice_number, due_date, creator_email } = req.body;
    const user_id = req.user.id;

    if (!deal_id) return res.status(400).json({ error: 'deal_id is required' });

    // Re-fetch deal to guarantee ownership — never trust client-supplied amounts or names
    const { data: deal, error } = await supabase
      .from('deals')
      .select('*')
      .eq('id', deal_id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (error) throw error;
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    const html = buildInvoiceHtml({
      invoice_number: invoice_number || 'INV-000000',
      brand_name: deal.brand_name,
      amount: deal.amount ?? 0,
      description: deal.notes || 'Brand Partnership Services',
      due_date: due_date || '30 days from date',
      creator_email: creator_email || '',
    });
    const pdf = await htmlToPdf(html);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${deal.brand_name.toLowerCase().replace(/\s+/g, '-')}.pdf"`);
    res.send(pdf);
  } catch (err) { next(err); }
}

function buildInvoiceHtml({ invoice_number, brand_name, amount, description, due_date, creator_email }) {
  const fmt = n => '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const safeInvoiceNumber = esc(invoice_number);
  const safeBrandName     = esc(brand_name);
  const safeDescription   = esc(description);
  const safeDueDate       = esc(due_date);
  const safeCreatorEmail  = esc(creator_email);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #1a1a1a; }
    .page { padding: 52px 60px; }
    .top-bar { background: #c9a040; height: 6px; margin: -52px -60px 44px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .brand-name { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #c9a040; margin-bottom: 6px; }
    .invoice-title { font-size: 28px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.03em; }
    .invoice-meta { text-align: right; font-size: 12px; color: #555; line-height: 2; }
    .invoice-meta strong { color: #1a1a1a; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 36px; padding-bottom: 28px; border-bottom: 1px solid #e8e0d0; }
    .party-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #c9a040; margin-bottom: 6px; }
    .party-name { font-size: 15px; font-weight: 600; color: #1a1a1a; }
    .party-sub { font-size: 12px; color: #888; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { background: #fdf8ee; }
    th { padding: 10px 16px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #888; text-align: left; border-bottom: 2px solid #e8e0d0; }
    td { padding: 16px; font-size: 13px; color: #333; border-bottom: 1px solid #f0ece4; vertical-align: top; }
    .total-row { background: #fdf8ee; }
    .total-row td { font-size: 15px; font-weight: 700; color: #1a1a1a; border-bottom: none; padding: 16px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e8e0d0; display: flex; justify-content: space-between; align-items: center; }
    .footer-note { font-size: 11px; color: #aaa; }
    .thank-you { font-size: 13px; color: #c9a040; font-weight: 600; }
  </style></head><body>
  <div class="page">
    <div class="top-bar"></div>
    <div class="header">
      <div>
        <div class="brand-name">Vesca · Invoice</div>
        <div class="invoice-title">Invoice</div>
      </div>
      <div class="invoice-meta">
        <div><strong>Invoice #</strong> ${safeInvoiceNumber || 'INV-000000'}</div>
        <div><strong>Date</strong> ${today}</div>
        <div><strong>Due</strong> ${safeDueDate || '30 days from date'}</div>
      </div>
    </div>
    <div class="parties">
      <div>
        <div class="party-label">From</div>
        <div class="party-name">${safeCreatorEmail || 'Creator'}</div>
        <div class="party-sub">Content Creator</div>
      </div>
      <div>
        <div class="party-label">To</div>
        <div class="party-name">${safeBrandName}</div>
        <div class="party-sub">Brand / Client</div>
      </div>
    </div>
    <table>
      <thead>
        <tr><th style="width:60%">Description</th><th>Qty</th><th style="text-align:right">Amount</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>${safeDescription || 'Brand Partnership Services'}</td>
          <td>1</td>
          <td style="text-align:right;font-weight:600;color:#1a1a1a">${fmt(amount)}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="2" style="text-align:right;color:#888;font-size:12px;font-weight:400">Total Due</td>
          <td style="text-align:right">${fmt(amount)}</td>
        </tr>
      </tfoot>
    </table>
    <p style="font-size:12px;color:#888;margin-bottom:8px">Payment Instructions: Please send payment via bank transfer, PayPal, or your preferred method within 30 days of the invoice date.</p>
    <div class="footer">
      <span class="thank-you">Thank you for the collaboration.</span>
      <span class="footer-note">Generated via Vesca · getvesca.com</span>
    </div>
  </div></body></html>`;
}

module.exports = { generateInvoice, downloadInvoicePdf };
