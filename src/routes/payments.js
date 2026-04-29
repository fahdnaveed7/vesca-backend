const router = require('express').Router();
const { updatePayment } = require('../controllers/payments');

// Dummy — no real payment processing
router.patch('/:deal_id', updatePayment);

module.exports = router;
