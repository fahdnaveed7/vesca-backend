/**
 * Welcome email sent immediately when a creator joins the waitlist.
 * Goal: make them feel seen, set expectations, build excitement.
 */
function waitlistWelcome({ email, position }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @media only screen and (max-width:600px) {
      .outer { padding: 12px 0 !important; }
      .card  { width: 100% !important; border-radius: 0 !important; }
      .hdr   { padding: 28px 24px !important; }
      .body  { padding: 28px 24px !important; }
      .foot  { padding: 16px 24px !important; }
      .pos   { font-size: 28px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <!-- preheader -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f4f4f8;">
    ${position ? `You're #${position} on the Vesca waitlist — your spot is locked in. 🎉` : `You're on the Vesca waitlist — your spot is locked in. 🎉`}
  </div>

  <table class="outer" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 0;">
    <tr><td align="center">
      <table class="card" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td class="hdr" style="background:#7C3AED;padding:32px 40px;">
            <p style="margin:0;font-size:12px;font-weight:800;letter-spacing:0.12em;color:#DDD6FE;text-transform:uppercase;">Vesca</p>
            <h1 style="margin:10px 0 0;font-size:26px;color:#fff;font-weight:900;line-height:1.2;">You're on the list. 🎉</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td class="body" style="padding:36px 40px;">
            ${position ? `<div style="background:#F5F3FF;border-radius:10px;padding:16px 20px;margin-bottom:28px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#6D28D9;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Your Waitlist Position</p>
              <p class="pos" style="margin:6px 0 0;font-size:40px;font-weight:900;color:#4C1D95;">#${position}</p>
            </div>` : ''}

            <p style="color:#1a1a1a;font-size:16px;line-height:1.75;margin:0 0 16px;">
              Hey creator 👋
            </p>
            <p style="color:#4B5563;font-size:15px;line-height:1.75;margin:0 0 16px;">
              You just secured your spot on the Vesca waitlist — the deal operating system built specifically for creators like you.
            </p>
            <p style="color:#4B5563;font-size:15px;line-height:1.75;margin:0 0 24px;">
              While you wait, here's what Vesca does that no spreadsheet can:
            </p>

            <!-- Feature list -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              ${[
                ['📬', 'Cold outreach', 'AI writes your brand pitch in 10 seconds'],
                ['📑', 'Proposals', 'Generate + send a PDF proposal in one click'],
                ['📥', 'Smart inbox', 'AI reads brand emails and extracts the deal details'],
                ['💰', 'Deal pipeline', 'Track every deal from "new" to "paid"'],
              ].map(([icon, title, desc]) => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:20px;padding-right:14px;vertical-align:top;">${icon}</td>
                    <td><strong style="color:#1a1a1a;font-size:14px;">${title}</strong><br>
                    <span style="color:#6B7280;font-size:13px;">${desc}</span></td>
                  </tr></table>
                </td>
              </tr>`).join('')}
            </table>

            <p style="color:#4B5563;font-size:15px;line-height:1.75;margin:0 0 28px;">
              We're onboarding creators in batches. You'll get an email with your access link the moment your spot opens up.
            </p>

            <p style="color:#1a1a1a;font-size:15px;margin:0;">
              Talk soon,<br>
              <strong>Fahd @ Vesca</strong>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td class="foot" style="padding:16px 40px;border-top:1px solid #F3F4F6;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;">
              You're receiving this because you signed up at <a href="https://getvesca.com" style="color:#7C3AED;text-decoration:none;">getvesca.com</a>.
              · <a href="mailto:hello@getvesca.com?subject=Unsubscribe" style="color:#9CA3AF;text-decoration:none;">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Weekly "Creator Tips" email — sent to the full waitlist every Monday.
 * Content is generated by Claude each week so it never goes stale.
 */
function weeklyCreatorTips({ tipsHtml, weekNumber }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @media only screen and (max-width:600px) {
      .outer { padding: 12px 0 !important; }
      .card  { width: 100% !important; border-radius: 0 !important; }
      .hdr   { padding: 24px 24px 20px !important; }
      .body  { padding: 24px 24px !important; }
      .cta   { padding: 0 24px 28px !important; }
      .foot  { padding: 16px 24px !important; }
    }
    /* Scope tip content styles */
    .tips-content h3 { font-size:16px; font-weight:700; color:#1a1a1a; margin:24px 0 6px; }
    .tips-content p  { font-size:15px; color:#4B5563; line-height:1.75; margin:0 0 12px; }
    .tips-content strong { color:#1a1a1a; }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <!-- preheader -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f4f4f8;">
    Week #${weekNumber}: 3 actionable tips to help you land and negotiate better brand deals.
  </div>

  <table class="outer" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 0;">
    <tr><td align="center">
      <table class="card" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Purple top accent bar -->
        <tr><td style="background:#7C3AED;height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- Header -->
        <tr>
          <td class="hdr" style="border-bottom:1px solid #F3F4F6;padding:28px 40px 24px;">
            <table width="100%"><tr>
              <td><span style="font-size:13px;font-weight:800;color:#7C3AED;letter-spacing:0.1em;text-transform:uppercase;">Vesca</span></td>
              <td align="right"><span style="font-size:12px;color:#9CA3AF;">Week #${weekNumber}</span></td>
            </tr></table>
            <h1 style="margin:12px 0 0;font-size:22px;color:#1a1a1a;font-weight:800;">Creator Deal Tips 💼</h1>
            <p style="margin:6px 0 0;font-size:14px;color:#6B7280;">Your weekly edge for landing better brand deals</p>
          </td>
        </tr>

        <!-- Tips content (Claude-generated HTML) — scoped via class -->
        <tr>
          <td class="body" style="padding:32px 40px;">
            <div class="tips-content">
              ${tipsHtml}
            </div>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td class="cta" style="padding:0 40px 36px;">
            <div style="background:#F5F3FF;border-radius:10px;padding:20px 24px;">
              <p style="margin:0 0 8px;font-size:14px;color:#4C1D95;font-weight:700;">🚀 Vesca early access is opening soon</p>
              <p style="margin:0;font-size:13px;color:#6D28D9;line-height:1.6;">You're on the list. We'll email you the moment your spot opens. In the meantime, share Vesca with a creator friend.</p>
              <a href="https://getvesca.com" style="display:inline-block;margin-top:14px;background:#7C3AED;color:#fff;text-decoration:none;padding:10px 22px;border-radius:6px;font-size:13px;font-weight:700;">Visit getvesca.com →</a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td class="foot" style="padding:16px 40px;border-top:1px solid #F3F4F6;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;">
              Sent by <a href="https://getvesca.com" style="color:#7C3AED;text-decoration:none;">Vesca</a>.
              You're on our waitlist — <a href="mailto:hello@getvesca.com?subject=Unsubscribe" style="color:#9CA3AF;text-decoration:none;">unsubscribe</a>.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Access granted email — sent when a waitlist user gets their invite.
 */
function accessGranted({ email }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @media only screen and (max-width:600px) {
      .outer { padding: 12px 0 !important; }
      .card  { width: 100% !important; border-radius: 0 !important; }
      .hdr   { padding: 36px 24px !important; }
      .body  { padding: 28px 24px !important; }
      .foot  { padding: 16px 24px !important; }
      .cta-btn { padding: 14px 28px !important; font-size: 15px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <!-- preheader -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f4f4f8;">
    Your Vesca access is ready — sign up now and claim your spot. 🎉
  </div>

  <table class="outer" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 0;">
    <tr><td align="center">
      <table class="card" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Hero header -->
        <tr>
          <td class="hdr" style="background:linear-gradient(135deg,#7C3AED 0%,#A855F7 100%);padding:40px;text-align:center;">
            <p style="margin:0 0 10px;font-size:44px;line-height:1;">🎉</p>
            <h1 style="margin:0;font-size:30px;color:#fff;font-weight:900;letter-spacing:-0.02em;">You're in.</h1>
            <p style="margin:10px 0 0;font-size:16px;color:#E9D5FF;font-weight:500;">Your Vesca access is ready.</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td class="body" style="padding:36px 40px;text-align:center;">
            <p style="color:#4B5563;font-size:15px;line-height:1.75;margin:0 0 28px;">
              The wait is over. Sign up with <strong style="color:#1a1a1a;">${email}</strong> and your account will be ready instantly.
            </p>
            <a class="cta-btn" href="https://getvesca.com/auth.html" style="display:inline-block;background:#7C3AED;color:#fff;text-decoration:none;padding:16px 40px;border-radius:8px;font-size:16px;font-weight:800;letter-spacing:0.01em;box-shadow:0 4px 14px rgba(124,58,237,0.4);">
              Claim My Access →
            </a>
            <p style="margin:20px 0 0;font-size:13px;color:#9CA3AF;">Use the email address you signed up with.</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td class="foot" style="padding:16px 40px;border-top:1px solid #F3F4F6;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;">
              <a href="https://getvesca.com" style="color:#7C3AED;text-decoration:none;">getvesca.com</a>
              · <a href="mailto:hello@getvesca.com?subject=Unsubscribe" style="color:#9CA3AF;text-decoration:none;">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

module.exports = { waitlistWelcome, weeklyCreatorTips, accessGranted };
