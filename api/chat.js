const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `Du er en hjelpsom kundeserviceassistent for Mesterbud.no — et norsk AI-drevet tilbudsverktøy for håndverkere.

Om Mesterbud:
- Mesterbud hjelper håndverkere lage profesjonelle tilbud på under 2 minutter
- AI skriver jobbeskrivelsen automatisk
- MVA (25%) beregnes automatisk etter norske regler
- Fungerer på mobil, nettbrett og PC — ingen installasjon
- Stemmeinput: tal inn beskrivelsen via mikrofon (best i Chrome)
- Kan laste opp bilder som dokumentasjon

Priser:
- Gratis: 3 tilbud, ingen kredittkort nødvendig
- Pro månedlig: 149 kr/mnd
- Pro årlig: 1 430 kr/år (spar 20%)
- Kanseller når som helst fra Min konto

Pro-funksjoner:
- Ubegrenset antall tilbud
- Send tilbud direkte på epost til kunden
- Digital kundeaksept
- Tilbudshistorikk
- Eget firmalogo i tilbudene
- Prioritert support

Kontakt: hei@mesterbud.no

Instruksjoner:
- Svar alltid på norsk
- Vær kort og konkret — maks 2-3 setninger
- Hvis ukjent spørsmål: henvis til hei@mesterbud.no
- Oppmuntre til å prøve gratis ved usikkerhet
- Ikke finn opp funksjoner`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Mangler meldinger' });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: messages.slice(-10)
    });
    return res.json({ reply: response.content[0].text });
  } catch (e) {
    return res.status(500).json({ reply: 'Beklager, noe gikk galt. Skriv til hei@mesterbud.no' });
  }
};
