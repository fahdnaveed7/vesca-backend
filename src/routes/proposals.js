const router = require('express').Router();
const { generateProposal, generatePdf, sendProposal } = require('../controllers/proposals');

router.post('/generate', generateProposal);
router.post('/pdf',      generatePdf);
router.post('/send',     sendProposal);

module.exports = router;
