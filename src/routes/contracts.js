const router = require('express').Router();
const { downloadContractPdf } = require('../controllers/contracts');

router.post('/pdf', downloadContractPdf);

module.exports = router;
