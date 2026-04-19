const Anthropic = require('@anthropic-ai/sdk');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { beskrivelse, firmNavn } = req.body;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Du er en norsk håndverker. Skriv en profesjonell og kortfattet jobbeskrivelse (3-4 setninger) for dette tilbudet. Jobbinfo: "${beskrivelse}". Firmanavn: ${firmNavn}. Skriv kun beskrivelsen, ingen overskrift.`
      }]
    });
    res.json({ text: msg.content[0].text });
  } catch (e) {
    res.json({ text: beskrivelse });
  }
};
