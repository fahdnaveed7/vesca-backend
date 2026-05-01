const router = require('express').Router();
const { listDeals, createDeal, updateDeal, updateDealStatus, deleteDeal } = require('../controllers/deals');

router.get('/',             listDeals);
router.post('/',            createDeal);
router.patch('/:id',        updateDeal);
router.patch('/:id/status', updateDealStatus);
router.delete('/:id',       deleteDeal);

module.exports = router;
