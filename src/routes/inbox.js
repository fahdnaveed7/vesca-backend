const router = require('express').Router();
const { handleInboundEmail } = require('../controllers/inbox');

// Webhook endpoint — simulate an inbound email arriving
router.post('/email', handleInboundEmail);

module.exports = router;
