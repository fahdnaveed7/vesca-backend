const supabase    = require('../services/supabase');
const { ask }     = require('../services/claude');
const { sendEmail } = require('../services/resend');
const { weeklyCreatorTips, accessGranted } = require('../emails/welcome');

// ─── POST /marketing/digest  (called by cron or manually) ────────────────────
// Generates AI creator tips then emails the entire waitlist.
// Requires CRON_SECRET header to prevent abuse.
async function sendWeeklyDigest(req, res, next) {
  try {
    if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 1. Fetch waitlist
    const { data: waitlist, error: wlErr } = await supabase
      .from('waitlist')
      .select('email')
      .order('created_at', { ascending: true });
    if (wlErr) throw wlErr;

    if (!waitlist?.length) {
      return res.json({ message: 'No waitlist subscribers yet', sent: 0 });
    }

    // 2. Generate this week's tips with Claude
    const weekNumber = getWeekNumber();
    const tipsText = await ask(
      `You are a senior creator economy strategist. Write actionable tips for creators on landing and negotiating brand deals.
       Be specific, practical, and punchy. Use a friendly-but-expert tone. No fluff.`,
      `Write this week's "Creator Deal Tips" newsletter section (Week #${weekNumber}).
       Include 3 tips. For each tip:
       - A bold headline (5-8 words max)
       - 2-3 sentences of actionable advice
       - One concrete example or number where possible

       Topics to rotate through: cold outreach psychology, rate negotiation, contract red flags,
       deliverable packaging, follow-up timing, brand research, exclusivity clauses, payment terms.

       Format as clean HTML using <h3> for headlines, <p> for body. Use <strong> for emphasis.
       Do not include a wrapper div or inline styles — just the content fragments.`,
      { maxTokens: 1000 }
    );

    // 3. Send to each subscriber (with small delay to avoid Resend rate limits)
    let sent = 0;
    let failed = 0;
    for (const { email } of waitlist) {
      try {
        await sendEmail({
          to: email,
          subject: `Creator Deal Tips — Week #${weekNumber} 💼`,
          html: weeklyCreatorTips({ tipsHtml: tipsText, weekNumber }),
          senderName: 'Fahd at Vesca',
        });
        sent++;
        // Tiny pause between sends
        await new Promise(r => setTimeout(r, 120));
      } catch (err) {
        console.error(`Failed to send digest to ${email}:`, err.message);
        failed++;
      }
    }

    // 4. Log the send in Supabase
    await supabase.from('marketing_sends').insert({
      type: 'weekly_digest',
      week_number: weekNumber,
      recipients: sent,
      failed,
      tips_preview: tipsText.slice(0, 500),
    }).then(() => {}).catch(() => {}); // non-critical

    res.json({ message: 'Weekly digest sent', sent, failed, weekNumber });
  } catch (err) {
    next(err);
  }
}

// ─── POST /marketing/grant-access  ────────────────────────────────────────────
// Send "You're in" email to a specific waitlist user (manual trigger from dashboard).
async function grantAccess(req, res, next) {
  try {
    if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    await sendEmail({
      to: email,
      subject: `Your Vesca access is ready 🎉`,
      html: accessGranted({ email }),
      senderName: 'Fahd at Vesca',
    });

    // Mark as granted in waitlist table
    await supabase
      .from('waitlist')
      .update({ access_granted: true, granted_at: new Date().toISOString() })
      .eq('email', email);

    res.json({ message: `Access email sent to ${email}` });
  } catch (err) {
    next(err);
  }
}

// ─── GET /marketing/content-ideas  ────────────────────────────────────────────
// Generate a week's worth of social media + SEO content ideas for Vesca.
async function getContentIdeas(req, res, next) {
  try {
    if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const ideas = await ask(
      `You are a B2B SaaS growth marketer who specialises in the creator economy.
       You write content that gets organic traction from Instagram/TikTok creators,
       YouTube creators, and anyone doing brand deals.`,
      `Generate a 7-day content calendar for Vesca — a deal management platform for creators.

       For each day provide:
       - Platform: (Twitter/X, Instagram, TikTok, LinkedIn, or Blog)
       - Content type: (tip, meme, testimonial-style, data insight, tutorial, etc.)
       - Hook (first line — must stop the scroll, under 15 words)
       - Body (3-4 sentences or bullet points)
       - CTA (one line)
       - Relevant hashtags (5-7)

       Angle: Vesca saves creators from messy spreadsheets and missed brand deals.
       Tone: Smart, punchy, creator-first. Not corporate.

       Format as clean JSON array with fields: day, platform, type, hook, body, cta, hashtags.`,
      { maxTokens: 2000 }
    );

    // Parse JSON from Claude response
    let parsed;
    try {
      const jsonMatch = ideas.match(/\[[\s\S]*\]/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : ideas;
    } catch {
      parsed = ideas; // return raw if parse fails
    }

    res.json({ week: getWeekNumber(), content: parsed });
  } catch (err) {
    next(err);
  }
}

// ─── GET /marketing/stats  ────────────────────────────────────────────────────
// Dashboard: waitlist size, digest history, conversion metrics.
async function getMarketingStats(req, res, next) {
  try {
    if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [waitlistRes, sendsRes, grantedRes] = await Promise.all([
      supabase.from('waitlist').select('*', { count: 'exact', head: true }),
      supabase.from('marketing_sends').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('waitlist').select('*', { count: 'exact', head: true }).eq('access_granted', true),
    ]);

    res.json({
      waitlist_total: waitlistRes.count || 0,
      access_granted: grantedRes.count || 0,
      recent_sends:   sendsRes.data || [],
    });
  } catch (err) {
    next(err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getWeekNumber() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

module.exports = { sendWeeklyDigest, grantAccess, getContentIdeas, getMarketingStats };
