const router = require('express').Router();
const { generateOutreach, sendOutreach } = require('../controllers/outreach');

router.post('/generate', generateOutreach);
router.post('/send',     sendOutreach);

module.exports = router;
