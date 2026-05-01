const supabase = require('../services/supabase');

const VALID_STATUSES = ['new', 'contacted', 'replied', 'negotiating', 'won', 'paid'];

// GET /deals
async function listDeals(req, res, next) {
  try {
    const { status } = req.query;
    const user_id = req.user.id;

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
    const { brand_name, notes, status = 'new', amount, follow_up_date } = req.body;
    const user_id = req.user.id;

    if (!brand_name) {
      return res.status(400).json({ error: 'brand_name is required' });
    }
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const payload = { user_id, brand_name, notes, status };
    if (amount      !== undefined && amount      !== null) payload.amount        = amount;
    if (follow_up_date !== undefined && follow_up_date !== null) payload.follow_up_date = follow_up_date;

    const { data, error } = await supabase
      .from('deals')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

// PATCH /deals/:id  — full update (status, amount, follow_up_date, notes)
async function updateDeal(req, res, next) {
  try {
    const { id } = req.params;
    const { status, amount, follow_up_date, notes } = req.body;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const patch = {};
    if (status        !== undefined) patch.status        = status;
    if (amount        !== undefined) patch.amount        = amount;
    if (follow_up_date !== undefined) patch.follow_up_date = follow_up_date;
    if (notes         !== undefined) patch.notes         = notes;

    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const { data, error } = await supabase
      .from('deals')
      .update(patch)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Deal not found' });

    res.json(data);
  } catch (err) {
    next(err);
  }
}

// PATCH /deals/:id/status  — quick status-only update (drag and drop)
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
      .eq('user_id', req.user.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Deal not found' });

    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { listDeals, createDeal, updateDeal, updateDealStatus };
