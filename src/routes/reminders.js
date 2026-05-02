const router = require('express').Router();
const { sendFollowUpReminders } = require('../controllers/reminders');

router.post('/send', sendFollowUpReminders);

module.exports = router;
