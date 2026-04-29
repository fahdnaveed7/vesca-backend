const router = require('express').Router();
const { joinWaitlist, getWaitlist } = require('../controllers/waitlist');

router.post('/', joinWaitlist);
router.get('/',  getWaitlist);

module.exports = router;
