const supabase = require('../services/supabase');
const { sendEmail } = require('../services/resend');
const { waitlistWelcome } = require('../emails/welcome');

async function joinWaitlist(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    // Get current count first (for position number)
    const { count } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });

    const { data, error } = await supabase
      .from('waitlist')
      .insert({ email })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Already on the waitlist!' });
      throw error;
    }

    // Send welcome email (fire-and-forget — don't block the response)
    const position = (count || 0) + 1;
    sendEmail({
      to: email,
      subject: `You're #${position} on the Vesca waitlist 🎉`,
      html: waitlistWelcome({ email, position }),
    }).catch(err => console.error('Welcome email failed:', err.message));

    res.status(201).json({ message: 'You are on the waitlist!', position, data });
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
