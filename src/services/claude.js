const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Single wrapper for all AI calls.
 * Same interface as before — swap back to Claude anytime by changing this file only.
 */
async function ask(systemPrompt, userPrompt, { model = 'gpt-4o-mini', maxTokens = 1024 } = {}) {
  const response = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
  });
  return response.choices[0].message.content;
}

module.exports = { ask };
