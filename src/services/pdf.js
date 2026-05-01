const puppeteer = require('puppeteer');

/**
 * Convert an HTML string into a PDF buffer.
 * Margins are set to 0 — all spacing is controlled in the HTML/CSS template.
 */
async function htmlToPdf(html) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  });

  await browser.close();
  return pdfBuffer;
}

module.exports = { htmlToPdf };
