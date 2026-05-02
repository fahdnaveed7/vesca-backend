const router = require('express').Router();
const { generateInvoice, downloadInvoicePdf } = require('../controllers/invoices');

router.post('/generate', generateInvoice);
router.post('/pdf', downloadInvoicePdf);

module.exports = router;
