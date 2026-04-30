const router = require('express').Router();
const { getProfile, updateProfile, getStats } = require('../controllers/profile');

router.get('/',       getProfile);
router.patch('/',     updateProfile);
router.get('/stats',  getStats);

module.exports = router;
