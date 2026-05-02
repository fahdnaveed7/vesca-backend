const supabase = require('../services/supabase');
const { sendEmail } = require('../services/resend');

// POST /reminders/send
// Protected by x-cron-secret header (checked in index.js before this route).
// Sends follow-up reminder emails for:
//   1. Stale deals: status 'contacted' or 'replied', not updated in 7+ days
//   2. Due-today deals: follow_up_date equals today's date
async function sendFollowUpReminders(req, res, next) {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // 1. Stale deals
    const { data: staleDeals, error: staleErr } = await supabase
      .from('deals')
      .select('id, brand_name, status, updated_at, user_id')
      .in('status', ['contacted', 'replied'])
      .lt('updated_at', sevenDaysAgo);

    if (staleErr) throw staleErr;

    // 2. Follow-up-due deals (follow_up_date = today)
    const { data: dueDeals, error: dueErr } = await supabase
      .from('deals')
      .select('id, brand_name, status, follow_up_date, user_id')
      .eq('follow_up_date', todayStr);

    if (dueErr) throw dueErr;

    // Merge, de-duplicate by deal id
    const seenIds = new Set();
    const allDeals = [];
    for (const deal of [...(staleDeals || []), ...(dueDeals || [])]) {
      if (!seenIds.has(deal.id)) {
        seenIds.add(deal.id);
        allDeals.push(deal);
      }
    }

    if (allDeals.length === 0) {
      return res.json({ sent: 0, message: 'No reminders to send.' });
    }

    // Collect unique user_ids and look up emails from the users table
    const userIds = [...new Set(allDeals.map(d => d.user_id))];
    const { data: users, error: userErr } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', userIds);

    if (userErr) throw userErr;

    if (!users || users.length === 0) {
      console.warn('[reminders] users query returned empty — check that the "users" table exists in the public schema with id, name, email columns');
    }

    const userMap = {};
    for (const u of users || []) {
      userMap[u.id] = u;
    }

    // Send one email per deal
    let sent = 0;
    const errors = [];

    for (const deal of allDeals) {
      const user = userMap[deal.user_id];
      if (!user?.email) continue; // skip if no email found

      const isStale = staleDeals && staleDeals.some(d => d.id === deal.id);
      const subject = isStale
        ? `Follow-up reminder: ${deal.brand_name} (${deal.status})`
        : `Follow-up due today: ${deal.brand_name}`;

      const html = buildReminderEmail({
        creatorName: user.name || user.email,
        brandName: deal.brand_name,
        status: deal.status,
        isStale,
        followUpDate: deal.follow_up_date || null,
      });

      try {
        await sendEmail({
          to: user.email,
          subject,
          html,
          senderName: 'Vesca',
        });
        sent++;
      } catch (emailErr) {
        errors.push({ deal_id: deal.id, error: emailErr.message });
      }
    }

    res.json({ sent, total: allDeals.length, errors: errors.length ? errors : undefined });
  } catch (err) { next(err); }
}

function buildReminderEmail({ creatorName, brandName, status, isStale, followUpDate }) {
  const actionLine = isStale
    ? `Your deal with <strong>${brandName}</strong> has been sitting in <em>${status}</em> for over 7 days. It may be time to send a follow-up.`
    : `You set a follow-up reminder for <strong>${brandName}</strong> — today is the day to reach out.`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#c9a040;height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:28px 40px 20px;border-bottom:1px solid #f3f4f6;">
            <span style="font-size:13px;font-weight:800;letter-spacing:0.1em;color:#c9a040;text-transform:uppercase;">Vesca</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px 32px;">
            <h1 style="margin:0 0 6px;font-size:22px;color:#1a1a1a;font-weight:800;">Follow-up Reminder</h1>
            <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Hi ${creatorName},</p>
            <p style="color:#374151;font-size:15px;line-height:1.75;margin:0 0 20px;">${actionLine}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#fdf8ee;border-left:3px solid #c9a040;border-radius:0 6px 6px 0;padding:14px 20px;">
                  <p style="margin:0;font-size:11px;color:#a07830;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Deal</p>
                  <p style="margin:6px 0 0;font-size:18px;font-weight:700;color:#1a1a1a;">${brandName}</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#888;">Status: ${status}${followUpDate ? ` · Follow-up: ${followUpDate}` : ''}</p>
                </td>
              </tr>
            </table>
            <p style="color:#374151;font-size:14px;line-height:1.75;margin:0;">
              Log in to <a href="https://getvesca.com" style="color:#c9a040;text-decoration:none;font-weight:600;">Vesca</a> to update your deal status or send a follow-up message.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 24px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              Sent by <a href="https://getvesca.com" style="color:#c9a040;text-decoration:none;">Vesca</a> — Creator Deal Management.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

module.exports = { sendFollowUpReminders };
