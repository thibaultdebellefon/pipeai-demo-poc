# PipeAI v2 — Proxy + Landing Page + Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Vercel serverless proxy to hide the Anthropic API key, create a landing page, and rebrand the diagnostic tool with a prep state before camera launch.

**Architecture:** Two HTML files (`index.html` = landing, `app.html` = tool) + one Vercel serverless function (`api/diagnose.js`) that holds the API key server-side. The frontend POSTs frames and transcript to `/api/diagnose`; the function forwards to Anthropic and returns the response. No key ever touches the browser.

**Tech Stack:** Plain HTML/CSS/JS, Vercel serverless functions (Node.js), Google Fonts (Inter), Anthropic Messages API.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `api/diagnose.js` | Create | Vercel serverless proxy — holds API key, calls Anthropic |
| `vercel.json` | Create | Vercel config — sets function timeout to 90s |
| `app.html` | Create (copy of `index.html`) | Diagnostic tool — rebrand + ready state + proxy call |
| `index.html` | Overwrite | Landing page — hero, how it works, features, footer CTA |

---

## Task 1: Create the Vercel serverless proxy

**Files:**
- Create: `api/diagnose.js`

- [ ] **Step 1: Create the `api/` directory and `diagnose.js`**

```bash
mkdir -p api
```

Create `api/diagnose.js` with this exact content:

```javascript
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

  const { frames, transcript } = req.body;

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
}
```

- [ ] **Step 2: Commit**

```bash
git add api/diagnose.js
git commit -m "feat: add Vercel serverless proxy for Anthropic API"
```

---

## Task 2: Add `vercel.json`

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create `vercel.json`**

The default Vercel function timeout is 10 seconds. The Anthropic call can take up to 60 seconds. Set `maxDuration` to 90 to give headroom.

```json
{
  "functions": {
    "api/diagnose.js": {
      "maxDuration": 90
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "chore: set Vercel function timeout to 90s"
```

---

## Task 3: Create `app.html` — proxy integration + remove API key

**Files:**
- Create: `app.html` (copy of current `index.html`, then modify)

This task has three parts: copy the file, update the API call to use the proxy, and rename `idle` → `ready` state with new prep content.

- [ ] **Step 1: Copy `index.html` to `app.html`**

```bash
cp index.html app.html
```

- [ ] **Step 2: Replace the idle state HTML in `app.html`**

Find and replace the entire `<!-- STATE: idle -->` block:

**Remove:**
```html
  <!-- STATE: idle -->
  <div id="state-idle" class="state active">
    <h1>PipeAI</h1>
    <p class="subtitle">Film the problem and describe it out loud.<br>AI will diagnose it in under 60 seconds.</p>
    <input id="api-key" class="api-input" type="password" placeholder="Paste your Anthropic API key" autocomplete="off" spellcheck="false">
    <p id="key-hint" class="hint">Paste your API key to continue.</p>
    <button id="btn-record" class="btn btn-primary" disabled>Record</button>
  </div>
```

**Replace with:**
```html
  <!-- STATE: ready -->
  <div id="state-ready" class="state active">
    <h1>PipeAI</h1>
    <p class="subtitle">Point your camera at the problem.<br>Describe what you're seeing out loud while recording.</p>
    <p class="subtitle" style="font-size:0.8rem;">AI will diagnose it in under 60 seconds.</p>
    <button id="btn-record" class="btn btn-primary">Start recording →</button>
  </div>
```

- [ ] **Step 3: Update the `btn-restart` and `btn-retry` listeners to go to `ready` instead of `idle`**

In `app.html`, find:
```javascript
    document.getElementById('btn-restart').addEventListener('click', () => setState('idle'));
    document.getElementById('btn-retry').addEventListener('click',   () => setState('idle'));
```

Replace with:
```javascript
    document.getElementById('btn-restart').addEventListener('click', () => { stopSpeaking(); setState('ready'); });
    document.getElementById('btn-retry').addEventListener('click',   () => setState('ready'));
```

- [ ] **Step 4: Update the STATES array in `app.html`**

Find:
```javascript
    const STATES = ['idle','recording','processing','result','error'];
```

Replace with:
```javascript
    const STATES = ['ready','recording','processing','result','error'];
```

- [ ] **Step 5: Remove the API key handling block in `app.html`**

Find and delete this entire block (lines starting from the comment to the display line):
```javascript
    // ── API key handling ───────────────────────────────────────────
    const apiKeyInput = document.getElementById('api-key');
    const btnRecord   = document.getElementById('btn-record');
    const keyHint     = document.getElementById('key-hint');

    function getApiKey() { return apiKeyInput.value.trim(); }

    apiKeyInput.addEventListener('input', () => {
      const hasKey = getApiKey().length > 0;
      btnRecord.disabled = !hasKey;
      keyHint.style.display = hasKey ? 'none' : 'block';
    });

    keyHint.style.display = 'block'; // show on load
```

Also remove the `const apiKeyInput`, `const btnRecord`, and `const keyHint` declarations — `btnRecord` is no longer needed as a module-level const since the button is now always enabled.

- [ ] **Step 6: Remove the `.api-input` and `.hint` CSS rules in `app.html`**

Find and delete:
```css
    .api-input {
      width: 100%; padding: 16px;
      background: #1e293b; border: 1px solid #334155; border-radius: 12px;
      color: #f1f5f9; font-size: 0.85rem; font-family: monospace;
    }
    .api-input::placeholder { color: #64748b; }
    .hint { font-size: 0.8rem; color: #f59e0b; text-align: center; }
```

- [ ] **Step 7: Update `analyseRecording()` in `app.html` to call the proxy**

Find the entire fetch block inside `analyseRecording()`:
```javascript
      const key = getApiKey();

      // Build content: frames first, then spoken context as text
      const content = extractedFrames.map(b64 => ({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: b64 }
      }));

      content.push({
        type: 'text',
        text: transcript.trim().length > 0
          ? 'Spoken description from the plumber: ' + transcript.trim()
          : 'No spoken description provided — diagnose from the video frames only.'
      });

      // 60-second timeout
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => {
        controller.abort();
        showError('This is taking longer than expected. Try again with a shorter recording.');
      }, 60000);

      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content }]
          })
        });

        clearTimeout(timeoutId);

        if (res.status === 401) { showError('Invalid API key. Check your Anthropic API key and try again.'); return; }
        if (res.status === 529) { showError('Anthropic API is overloaded right now. Wait a few seconds and try again.'); return; }
        if (!res.ok)            { showError('Analysis failed (HTTP ' + res.status + '). Check your connection and try again.'); return; }
```

Replace with:
```javascript
      // 60-second timeout
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => {
        controller.abort();
        showError('This is taking longer than expected. Try again with a shorter recording.');
      }, 60000);

      try {
        const res = await fetch('/api/diagnose', {
          method: 'POST',
          signal: controller.signal,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ frames: extractedFrames, transcript: transcript.trim() })
        });

        clearTimeout(timeoutId);

        if (res.status === 401) { showError('API configuration error. Please contact support.'); return; }
        if (res.status === 529) { showError('AI service is overloaded right now. Wait a few seconds and try again.'); return; }
        if (!res.ok)            { showError('Analysis failed (HTTP ' + res.status + '). Check your connection and try again.'); return; }
```

Also remove the `const SYSTEM_PROMPT` block from `app.html` — it now lives in `api/diagnose.js` only.

- [ ] **Step 8: Verify `app.html` opens in browser and shows the ready state**

Open `app.html` directly in Chrome on desktop:
```bash
open app.html
```
Expected: Dark page, "PipeAI" heading, instructions, "Start recording →" button. No API key field visible.

- [ ] **Step 9: Commit**

```bash
git add app.html
git commit -m "feat: add app.html with proxy integration and ready state"
```

---

## Task 4: Apply brand to `app.html`

**Files:**
- Modify: `app.html` (CSS only)

- [ ] **Step 1: Add Inter font and update CSS variables in `app.html`**

Add the Google Fonts link inside `<head>`, just before `<style>`:
```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap">
```

- [ ] **Step 2: Replace the CSS reset and body rules**

Find:
```css
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f172a;
      color: #f1f5f9;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: max(24px, env(safe-area-inset-top))
               max(24px, env(safe-area-inset-right))
               max(24px, env(safe-area-inset-bottom))
               max(24px, env(safe-area-inset-left));
    }
```

Replace with:
```css
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:           #0a0f1e;
      --surface:      #111827;
      --border:       #1f2937;
      --accent:       #f97316;
      --accent-dark:  #c2410c;
      --text:         #f1f5f9;
      --muted:        #94a3b8;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: max(24px, env(safe-area-inset-top))
               max(24px, env(safe-area-inset-right))
               max(24px, env(safe-area-inset-bottom))
               max(24px, env(safe-area-inset-left));
    }
```

- [ ] **Step 3: Update card, button, and surface colors to use CSS variables**

Find and replace:
```css
    .btn-primary   { background: #3b82f6; color: white; }
```
With:
```css
    .btn-primary   { background: var(--accent); color: white; }
    .btn-primary:hover { background: var(--accent-dark); }
```

Find and replace:
```css
    .card {
      width: 100%; background: #1e293b;
      border-radius: 12px; padding: 16px; border: 1px solid #334155;
    }
```
With:
```css
    .card {
      width: 100%; background: var(--surface);
      border-radius: 12px; padding: 16px; border: 1px solid var(--border);
    }
```

Find and replace:
```css
    .btn-secondary { background: #1e293b; color: #94a3b8; border: 1px solid #334155; }
```
With:
```css
    .btn-secondary { background: var(--surface); color: var(--muted); border: 1px solid var(--border); }
```

Find and replace:
```css
    .step-num { font-weight: 700; color: #3b82f6; min-width: 20px; }
```
With:
```css
    .step-num { font-weight: 700; color: var(--accent); min-width: 20px; }
```

Find and replace:
```css
    .tool-tag {
      background: #0f172a; border: 1px solid #334155;
      border-radius: 6px; padding: 3px 8px; font-size: 0.75rem; color: #94a3b8;
    }
```
With:
```css
    .tool-tag {
      background: var(--bg); border: 1px solid var(--border);
      border-radius: 6px; padding: 3px 8px; font-size: 0.75rem; color: var(--muted);
    }
```

Find and replace:
```css
    .spinner {
      width: 48px; height: 48px;
      border: 4px solid #1e293b; border-top-color: #3b82f6;
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }
```
With:
```css
    .spinner {
      width: 48px; height: 48px;
      border: 4px solid var(--surface); border-top-color: var(--accent);
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }
```

Find and replace:
```css
    .step-row { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid #0f172a; }
```
With:
```css
    .step-row { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--bg); }
```

- [ ] **Step 4: Verify brand looks correct in browser**

Open `app.html` in Chrome:
```bash
open app.html
```
Expected: Deep navy background (`#0a0f1e`), copper orange "Start recording →" button, Inter font.

- [ ] **Step 5: Commit**

```bash
git add app.html
git commit -m "feat: apply brand to app.html (Inter font, copper orange accent)"
```

---

## Task 5: Create the landing page (`index.html`)

**Files:**
- Overwrite: `index.html`

- [ ] **Step 1: Replace `index.html` with the landing page**

Overwrite `index.html` with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0a0f1e">
  <meta name="description" content="PipeAI — AI diagnostic assistant for field plumbers. Film the problem, describe it out loud, get a ranked action plan in under 60 seconds.">
  <title>PipeAI — AI Diagnostic Assistant for Plumbers</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:          #0a0f1e;
      --surface:     #111827;
      --border:      #1f2937;
      --accent:      #f97316;
      --accent-dark: #c2410c;
      --text:        #f1f5f9;
      --muted:       #94a3b8;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
    }

    /* ── Shared ── */
    .btn {
      display: inline-block;
      padding: 16px 32px;
      border: none; border-radius: 14px;
      font-size: 1rem; font-weight: 700;
      cursor: pointer; text-decoration: none;
      transition: background 0.15s, transform 0.1s;
      touch-action: manipulation;
    }
    .btn:active { transform: scale(0.97); }
    .btn-primary { background: var(--accent); color: white; }
    .btn-primary:hover { background: var(--accent-dark); }

    section { padding: 80px 24px; }

    .container { max-width: 720px; margin: 0 auto; }

    /* ── Hero ── */
    #hero {
      min-height: 100dvh;
      display: flex; align-items: center; justify-content: center;
      text-align: center;
      padding: 80px 24px;
    }

    #hero .eyebrow {
      font-size: 0.8rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.12em;
      color: var(--accent); margin-bottom: 20px;
    }

    #hero h1 {
      font-size: clamp(2rem, 6vw, 3.5rem);
      font-weight: 700; line-height: 1.1;
      letter-spacing: -0.03em;
      margin-bottom: 20px;
    }

    #hero h1 span { color: var(--accent); }

    #hero p {
      font-size: 1.1rem; color: var(--muted);
      line-height: 1.7; max-width: 520px;
      margin: 0 auto 36px;
    }

    /* ── How it works ── */
    #how { background: var(--surface); }

    #how h2, #features h2, #video-section h2, #footer-cta h2 {
      font-size: clamp(1.5rem, 4vw, 2rem);
      font-weight: 700; letter-spacing: -0.02em;
      margin-bottom: 48px; text-align: center;
    }

    .steps {
      display: flex; flex-direction: column; gap: 32px;
    }

    @media (min-width: 640px) {
      .steps { flex-direction: row; gap: 24px; }
    }

    .step {
      flex: 1;
      display: flex; flex-direction: column; align-items: center;
      text-align: center; gap: 12px;
    }

    .step-icon {
      width: 56px; height: 56px;
      background: var(--bg); border: 1px solid var(--border);
      border-radius: 16px;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.5rem;
    }

    .step-title { font-weight: 700; font-size: 1rem; }
    .step-desc  { font-size: 0.875rem; color: var(--muted); line-height: 1.6; }

    /* ── Features ── */
    .cards {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
    }

    @media (min-width: 640px) {
      .cards { grid-template-columns: repeat(3, 1fr); }
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px; padding: 24px;
    }

    .card-icon { font-size: 1.75rem; margin-bottom: 12px; }
    .card-title { font-weight: 700; margin-bottom: 8px; }
    .card-desc  { font-size: 0.875rem; color: var(--muted); line-height: 1.6; }

    /* ── Video placeholder ── */
    #video-section { background: var(--surface); }

    .video-placeholder {
      max-width: 640px; margin: 0 auto;
      aspect-ratio: 16 / 9;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 12px; color: var(--muted);
    }

    .video-placeholder .play-icon {
      width: 56px; height: 56px;
      border: 2px solid var(--border);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.25rem;
    }

    /* ── Footer CTA ── */
    #footer-cta { text-align: center; }

    #footer-cta p {
      color: var(--muted); margin-bottom: 32px;
      font-size: 1rem; line-height: 1.7;
    }

    footer {
      text-align: center; padding: 24px;
      color: var(--muted); font-size: 0.8rem;
      border-top: 1px solid var(--border);
    }
  </style>
</head>
<body>

  <!-- Hero -->
  <section id="hero">
    <div class="container">
      <p class="eyebrow">AI for field plumbers</p>
      <h1>Your AI plumbing expert,<br><span>on every job site.</span></h1>
      <p>Junior plumbers film the problem, describe it out loud — PipeAI diagnoses it and reads back a ranked action plan in under 60 seconds.</p>
      <a href="app.html" class="btn btn-primary">Try it now →</a>
    </div>
  </section>

  <!-- How it works -->
  <section id="how">
    <div class="container">
      <h2>How it works</h2>
      <div class="steps">
        <div class="step">
          <div class="step-icon">🎥</div>
          <div class="step-title">Film</div>
          <div class="step-desc">Point your camera at the problem — under the sink, behind the wall, wherever it is.</div>
        </div>
        <div class="step">
          <div class="step-icon">🎙</div>
          <div class="step-title">Describe</div>
          <div class="step-desc">Say out loud what you're seeing and hearing while you record. The more detail, the better.</div>
        </div>
        <div class="step">
          <div class="step-icon">⚡</div>
          <div class="step-title">Get your answer</div>
          <div class="step-desc">AI returns a ranked action plan, tools required, and safety warnings — then reads it back to you.</div>
        </div>
      </div>
    </div>
  </section>

  <!-- Built for the field -->
  <section id="features">
    <div class="container">
      <h2>Built for the field</h2>
      <div class="cards">
        <div class="card">
          <div class="card-icon">🔦</div>
          <div class="card-title">Works in low light</div>
          <div class="card-desc">Designed for real job sites — under sinks, in crawl spaces, not ideal studio conditions.</div>
        </div>
        <div class="card">
          <div class="card-icon">🧤</div>
          <div class="card-title">One-handed, gloves on</div>
          <div class="card-desc">Large touch targets throughout. Full flow completable without removing your gloves.</div>
        </div>
        <div class="card">
          <div class="card-icon">⏱</div>
          <div class="card-title">Under 60 seconds</div>
          <div class="card-desc">From recording end to first recommendation. Fast enough to use mid-job without losing time.</div>
        </div>
      </div>
    </div>
  </section>

  <!-- Video placeholder -->
  <section id="video-section">
    <div class="container">
      <h2>See it in action</h2>
      <div class="video-placeholder">
        <div class="play-icon">▶</div>
        <span>Demo coming soon</span>
      </div>
    </div>
  </section>

  <!-- Footer CTA -->
  <section id="footer-cta">
    <div class="container">
      <h2>Ready to give your team an expert in their pocket?</h2>
      <p>No account required. Open your camera, describe the problem, get your answer.</p>
      <a href="app.html" class="btn btn-primary">Try it now →</a>
    </div>
  </section>

  <footer>
    PipeAI &copy; 2026
  </footer>

</body>
</html>
```

- [ ] **Step 2: Verify landing page in browser**

```bash
open index.html
```

Expected: Dark navy page, copper orange "Try it now →" buttons, three-step flow, three feature cards, video placeholder, footer CTA. Clicking "Try it now →" should open `app.html`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add landing page with hero, how it works, features, footer CTA"
```

---

## Task 6: Deploy to Vercel and set API key

This task is mostly manual steps in the browser. No code changes.

- [ ] **Step 1: Push all commits to GitHub**

```bash
git push
```

- [ ] **Step 2: Create a Vercel account and import the repo**

1. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account
2. Click "Add New Project"
3. Import `thibaultdebellefon/pipeai-demo-poc`
4. Leave all settings as default — Vercel will auto-detect no framework
5. Click "Deploy"

Wait for the first deployment to complete (~1 minute). You will get a URL like `https://pipeai-demo-poc.vercel.app`.

- [ ] **Step 3: Set the `ANTHROPIC_API_KEY` environment variable**

1. In the Vercel dashboard, open your project
2. Go to **Settings → Environment Variables**
3. Add a new variable:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your Anthropic API key (`sk-ant-...`)
   - Environment: Production, Preview, Development (check all three)
4. Click **Save**

- [ ] **Step 4: Redeploy to apply the environment variable**

1. Go to **Deployments** tab in Vercel
2. Click the three-dot menu on the latest deployment
3. Click **Redeploy**

Wait ~1 minute for the new deployment.

- [ ] **Step 5: Smoke-test the proxy directly**

Replace `YOUR_VERCEL_URL` with your actual deployment URL:

```bash
curl -X POST https://YOUR_VERCEL_URL/api/diagnose \
  -H "Content-Type: application/json" \
  -d '{"frames":[],"transcript":"test"}' \
  -w "\nHTTP %{http_code}\n"
```

Expected: HTTP 400 with `{"error":"At least one frame is required"}` — confirms the function is running and the env var is loaded.

- [ ] **Step 6: Full end-to-end test on iPhone**

Open `https://YOUR_VERCEL_URL` on your iPhone.
- Landing page loads with correct brand
- "Try it now →" opens `app.html` (the tool)
- Ready state shows with "Start recording →" button
- Record a 10-second clip of anything, speak a description
- Result appears and is read aloud

---

## Spec coverage check

| Requirement | Task |
|---|---|
| API key hidden from browser | Task 1 (proxy), Task 3 (remove key input) |
| Vercel environment variable | Task 6 |
| Landing page with hero + CTA | Task 5 |
| How it works section | Task 5 |
| Built for the field section | Task 5 |
| Video placeholder | Task 5 |
| Footer CTA | Task 5 |
| Prep state before camera launch | Task 3 |
| Brand — Inter font, copper orange | Task 4 |
| Brand — deep navy background | Task 4 |
| No API key input | Task 3 |
| No login | (no task — nothing to build) |
| Deployed to Vercel with HTTPS | Task 6 |
