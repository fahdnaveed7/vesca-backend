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
      handle_ig, handle_tiktok, handle_youtube, handle_twitter,
      username,
    } = req.body;

    // Validate username format if provided
    if (username !== undefined && username !== null && username !== '') {
      if (!/^[a-z0-9_]{3,30}$/.test(username)) {
        return res.status(400).json({ error: 'Username must be 3–30 characters: lowercase letters, numbers, and underscores only.' });
      }
      // Check uniqueness (excluding this user)
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .neq('id', req.user.id)
        .maybeSingle();
      if (existing) return res.status(409).json({ error: 'That username is already taken.' });
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        name, bio, niche, platforms, follower_count,
        rate_story, rate_feed, rate_youtube, rate_tiktok,
        default_niche, default_pitch,
        handle_ig, handle_tiktok, handle_youtube, handle_twitter,
        ...(username !== undefined ? { username: username || null } : {}),
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /kit/:user_id — public, no auth required
// Returns only public-safe fields (no email, no rates, no internal data)
async function getPublicKit(req, res, next) {
  try {
    const { user_id } = req.params;
    if (!user_id || !UUID_RE.test(user_id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const { data, error } = await supabase
      .from('users')
      .select('name, bio, niche, follower_count, handle_ig, handle_tiktok, handle_youtube, handle_twitter, platforms, username')
      .eq('id', user_id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Kit not found' });

    res.json(data);
  } catch (err) { next(err); }
}

// GET /kit/u/:username — public, lookup kit by username
async function getPublicKitByUsername(req, res, next) {
  try {
    const { username } = req.params;
    if (!username || !/^[a-z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({ error: 'Invalid username' });
    }

    const { data, error } = await supabase
      .from('users')
      .select('name, bio, niche, follower_count, handle_ig, handle_tiktok, handle_youtube, handle_twitter, platforms, username')
      .eq('username', username)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Kit not found' });

    res.json(data);
  } catch (err) { next(err); }
}

// POST /auth/resolve-username — public
// Accepts { username }, returns { email } so the frontend can sign in with email+password
// Rate-limited in index.js (general limiter covers it)
async function resolveUsername(req, res, next) {
  try {
    const { username } = req.body;
    if (!username || !/^[a-z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({ error: 'Invalid username' });
    }

    const { data, error } = await supabase
      .from('users')
      .select('email')
      .eq('username', username)
      .maybeSingle();

    if (error) throw error;
    // Return a generic 404 to avoid username enumeration leaking email addresses
    if (!data?.email) return res.status(404).json({ error: 'No account found with that username.' });

    res.json({ email: data.email });
  } catch (err) { next(err); }
}

module.exports = { getProfile, updateProfile, getStats, getPublicKit, getPublicKitByUsername, resolveUsername };
