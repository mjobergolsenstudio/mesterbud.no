const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const GRATIS_GRENSE = 3;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { beskrivelse, firmNavn, userId } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Ikke innlogget' });
  }

  // Supabase med service key for å lese/skrive uavhengig av RLS
  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // Hent brukerens abonnement
  const { data: proData } = await sb
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  const erPro = !!proData;

  if (!erPro) {
    // Tell antall tilbud
    const { count } = await sb
      .from('tilbud')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (count >= GRATIS_GRENSE) {
      return res.status(403).json({
        error: 'kvote',
        message: `Du har brukt alle ${GRATIS_GRENSE} gratis tilbud. Oppgrader til Pro for ubegrenset tilgang.`,
        antall: count
      });
    }
  }

  // Generer tekst med AI
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Du er en norsk håndverker. Skriv en profesjonell og kortfattet jobbeskrivelse (3-4 setninger) for dette tilbudet. Jobbinfo: "${beskrivelse}". Firmanavn: ${firmNavn}`
      }]
    });

    // Logg tilbudet i Supabase
    await sb.from('tilbud').insert({ user_id: userId });

    return res.json({ text: msg.content[0].text });
  } catch (e) {
    return res.json({ text: beskrivelse });
  }
};
