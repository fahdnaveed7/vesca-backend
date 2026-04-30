const supabase = require('../services/supabase');

async function getProfile(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .maybeSingle();
    if (error) throw error;

    if (!data) {
      // Auto-create profile for users who bypassed the trigger (e.g. admin-created)
      const name = req.user.user_metadata?.name || req.user.email?.split('@')[0] || 'Creator';
      const { data: created, error: createErr } = await supabase
        .from('users')
        .insert({ id: req.user.id, email: req.user.email, name })
        .select()
        .single();
      if (createErr) throw createErr;
      return res.json(created);
    }

    res.json(data);
  } catch (err) { next(err); }
}

async function updateProfile(req, res, next) {
  try {
    const {
      name, bio, niche, platforms, follower_count,
      rate_story, rate_feed, rate_youtube, rate_tiktok,
      default_niche, default_pitch,
    } = req.body;

    const { data, error } = await supabase
      .from('users')
      .update({
        name, bio, niche, platforms, follower_count,
        rate_story, rate_feed, rate_youtube, rate_tiktok,
        default_niche, default_pitch,
      })
      .eq('id', req.user.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
}

async function getStats(req, res, next) {
  try {
    const { data: deals, error } = await supabase
      .from('deals')
      .select('id, status')
      .eq('user_id', req.user.id);
    if (error) throw error;

    const dealIds = (deals || []).map(d => d.id);
    const { data: payments } = dealIds.length
      ? await supabase.from('payments').select('amount').in('deal_id', dealIds)
      : { data: [] };

    const won     = deals.filter(d => d.status === 'won' || d.status === 'paid');
    const paid    = deals.filter(d => d.status === 'paid');
    const total   = (payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const avg     = won.length ? Math.round(total / won.length) : 0;

    res.json({
      total_deals:   deals.length,
      deals_won:     won.length,
      deals_paid:    paid.length,
      total_earned:  total,
      avg_deal_value: avg,
    });
  } catch (err) { next(err); }
}

module.exports = { getProfile, updateProfile, getStats };
