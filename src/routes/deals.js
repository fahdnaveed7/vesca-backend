const router = require('express').Router();
const { listDeals, createDeal, updateDeal, updateDealStatus } = require('../controllers/deals');

router.get('/',             listDeals);
router.post('/',            createDeal);
router.patch('/:id',        updateDeal);
router.patch('/:id/status', updateDealStatus);

module.exports = router;
