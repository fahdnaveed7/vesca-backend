const supabase = require('../services/supabase');

async function joinWaitlist(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const { data, error } = await supabase
      .from('waitlist')
      .insert({ email })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Already on the waitlist!' });
      throw error;
    }

    res.status(201).json({ message: 'You are on the waitlist!', data });
  } catch (err) { next(err); }
}

async function getWaitlist(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('waitlist')
      .select()
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ count: data.length, emails: data });
  } catch (err) { next(err); }
}

module.exports = { joinWaitlist, getWaitlist };
