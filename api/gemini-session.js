export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.GEMINI_API_KEY) {
    console.error('[gemini-session] GEMINI_API_KEY is not set');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  return res.status(200).json({ apiKey: process.env.GEMINI_API_KEY });
}
