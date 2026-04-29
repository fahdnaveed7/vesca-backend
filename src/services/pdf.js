const puppeteer = require('puppeteer');

/**
 * Convert an HTML string into a PDF buffer.
 * Returns a Buffer — caller decides whether to save or attach.
 */
async function htmlToPdf(html) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '40px', bottom: '40px', left: '48px', right: '48px' },
  });

  await browser.close();
  return pdfBuffer;
}

module.exports = { htmlToPdf };
