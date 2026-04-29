/**
 * All Claude prompt templates live here.
 * Keep system prompts short and role-specific.
 * User prompts carry the dynamic data.
 */

const SYSTEM = {
  outreach: `You are an expert influencer marketing strategist.
Write concise, personable cold outreach emails for creators pitching brand partnerships.
Tone: professional but warm. No fluff. Max 200 words.`,

  followUp: `You are a creator partnership manager writing a brief follow-up email.
Reference the original pitch. Keep it under 100 words. Friendly, not pushy.`,

  proposal: `You are a professional proposal writer for creator partnerships.
Structure proposals clearly with sections: Overview, Deliverables, Timeline, Pricing, Next Steps.
Use markdown headings. Be specific and confident.`,

  inboundAnalysis: `You are an AI assistant that analyzes inbound brand emails received by a creator.
Extract structured data and return ONLY valid JSON — no explanation, no markdown.`,

  replySuggestion: `You are a creator partnership manager.
Write a warm, professional reply to a brand's inbound email. Keep it under 150 words.`,
};

function outreachEmail({ brand, niche, pitch }) {
  return {
    system: SYSTEM.outreach,
    user: `Write a cold outreach email to ${brand}.
Creator niche: ${niche}
Key pitch: ${pitch}
Return only the email body (no subject line).`,
  };
}

function followUpEmail({ brand, originalPitch, daysSince }) {
  return {
    system: SYSTEM.followUp,
    user: `Follow up with ${brand} about a partnership offer sent ${daysSince} days ago.
Original pitch summary: ${originalPitch}`,
  };
}

function proposalText({ brand, deliverables, price, timeline, creatorName }) {
  return {
    system: SYSTEM.proposal,
    user: `Generate a partnership proposal.
Creator: ${creatorName}
Brand: ${brand}
Deliverables: ${deliverables}
Price: $${price}
Timeline: ${timeline}`,
  };
}

function inboundAnalysis({ emailText }) {
  return {
    system: SYSTEM.inboundAnalysis,
    user: `Analyze this inbound email from a brand and return JSON in this exact shape:
{
  "brand_name": "string",
  "intent": "collab" | "not_collab",
  "summary": "one sentence summary",
  "key_details": "any important numbers, dates, or asks"
}

Email:
${emailText}`,
  };
}

function replySuggestion({ brand, emailText }) {
  return {
    system: SYSTEM.replySuggestion,
    user: `Write a reply to this inbound email from ${brand}:

${emailText}`,
  };
}

module.exports = {
  outreachEmail,
  followUpEmail,
  proposalText,
  inboundAnalysis,
  replySuggestion,
};
