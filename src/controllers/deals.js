const supabase = require('../services/supabase');

const VALID_STATUSES = ['new', 'contacted', 'replied', 'negotiating', 'won', 'paid'];

// GET /deals?user_id=xxx&status=xxx
async function listDeals(req, res, next) {
  try {
    const { user_id, status } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    let query = supabase
      .from('deals')
      .select('*, proposals(*), messages(*), outreach(*)')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) {
    next(err);
  }
}

// POST /deals
async function createDeal(req, res, next) {
  try {
    const { user_id, brand_name, notes, status = 'new' } = req.body;
    if (!user_id || !brand_name) {
      return res.status(400).json({ error: 'user_id and brand_name are required' });
    }
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('deals')
      .insert({ user_id, brand_name, notes, status })
      .select()
      .single();
    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

// PATCH /deals/:id/status
async function updateDealStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('deals')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { listDeals, createDeal, updateDealStatus };
