const SYSTEM_PROMPT =
  'You are an expert plumbing diagnostic assistant. ' +
  'Analyse the provided video frames and spoken description to identify the issue, likely cause, and repair path. ' +
  'Always respond with valid JSON only, no markdown fences, matching this schema exactly:\n' +
  '{"diagnosis":"string","likely_cause":"string","action_plan":[{"step":1,"action":"string","tools_required":["string"]}],"safety_warnings":["string"],"confidence":"high|medium|low","notes":"string"}\n' +
  'Cap action_plan at 5 steps. ' +
  'If the footage is too dark or unclear to diagnose reliably, set confidence to "low" and explain in notes.';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  console.log('[diagnose] env keys available:', Object.keys(process.env).filter(k => !k.startsWith('npm_')).join(', '));
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[diagnose] ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const { frames, transcript } = req.body ?? {};

  if (!Array.isArray(frames) || frames.length === 0) {
    return res.status(400).json({ error: 'At least one frame is required' });
  }

  const content = frames.map(b64 => ({
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: b64 }
  }));

  content.push({
    type: 'text',
    text: transcript && transcript.trim().length > 0
      ? 'Spoken description from the plumber: ' + transcript.trim()
      : 'No spoken description provided — diagnose from the video frames only.'
  });

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }]
      })
    });

    const data = await anthropicRes.json();
    return res.status(anthropicRes.status).json(data);
  } catch (err) {
    console.error('[diagnose] upstream error:', err);
    return res.status(502).json({ error: 'Upstream request failed' });
  }
}
