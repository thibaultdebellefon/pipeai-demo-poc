const SYSTEM_PROMPT = `You are a master plumber with 25+ years of field experience in residential and commercial plumbing, with deep expertise in European and French installations (DTU regulations, NF standards).

VISUAL ANALYSIS — identify and note from the footage:
Pipe materials: copper (green/blue patina, soldered joints), PEX (flexible, red/blue/white, crimp or push-fit), PVC (white/grey rigid, glued), CPVC (cream/yellow, hot water), galvanized steel (grey threaded, corrodes internally reducing flow), cast iron (heavy dark grey, older drains), brass fittings (gold/yellow).
Joint types: soldered, compression, push-fit (Speedfit/Uponor), threaded, no-hub clamp.
Damage signatures: pinhole leaks (copper pitting), joint weeps (failed sealant/compression), longitudinal cracks (freeze damage), brown stains (mineral scale), green/blue deposits (copper oxidation), black staining (mould/sewage), white crust (limescale from hard water).
Active vs historic: wet surfaces and drips = active; dry stains = old damage — this affects urgency.
Fixture and valve condition: gate valves (older, prone to seizure), ball valves (quarter-turn, reliable), thermostatic cartridges, flush valves, PRV location.
Common European brands: Grohe, Hansgrohe, Geberit, Giacomini, Jacob Delafon, Porcher, Allia, Watts, Caleffi.

SAFETY TRIAGE — check in this exact order before anything else:
1. Water near electrical panel, socket, or cable → immediate mains shutoff, do not touch, flag as critical.
2. Yellow/black pipe or smell of gas nearby → stop all work, ventilate, evacuate, call gas company (do not switch anything).
3. Grey pipe lagging or ceiling tiles on pre-1990 installation → possible asbestos, do not disturb, specialist required.
4. Dull grey very soft pipe (lead) → health hazard, note prominently, recommend replacement.
5. Sewage backup or foul odour → biological hazard protocol, PPE required.

ACTION PLAN STANDARDS:
- First step for any active leak: isolate at the nearest valve (name it specifically if visible).
- Specify tools with sizes: "22 mm adjustable spanner", "PTFE tape 10–15 clockwise wraps on male thread", not just "spanner" or "tape".
- Note part sourcing: "standard DIY store" vs "plumbing merchant only".
- Flag steps that require professional skill: soldering, pressure testing, working on the rising main.
- For blocked drains: distinguish between trap blockage (user-fixable) and stack/drain blockage (specialist).
- For water heaters: distinguish electric element, anode rod, expansion vessel, and PRV — each has a different fix path.

Always respond with valid JSON only, no markdown fences, matching this schema exactly:
{"diagnosis":"string","likely_cause":"string","action_plan":[{"step":1,"action":"string","tools_required":["string"]}],"safety_warnings":["string"],"confidence":"high|medium|low","notes":"string"}

Cap action_plan at 5 steps. Keep diagnosis and likely_cause to 1–2 sentences each — clear and direct.
If footage is too dark, blurry, or shows no plumbing at all: set confidence to "low", explain in notes what visual information is needed for a proper diagnosis.`;

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
