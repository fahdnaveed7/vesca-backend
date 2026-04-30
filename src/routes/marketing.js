const router = require('express').Router();
const {
  sendWeeklyDigest,
  grantAccess,
  getContentIdeas,
  getMarketingStats,
} = require('../controllers/marketing');

// All endpoints protected by CRON_SECRET header (no user auth needed — internal/cron use)
router.post('/digest',        sendWeeklyDigest);
router.post('/grant-access',  grantAccess);
router.get('/content-ideas',  getContentIdeas);
router.get('/stats',          getMarketingStats);

module.exports = router;
