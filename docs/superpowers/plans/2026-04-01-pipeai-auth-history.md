# PipeAI Auth + History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google login, user profiles, and diagnosis history to PipeAI using Supabase, storing one JPEG thumbnail + diagnosis JSON per session.

**Architecture:** Supabase JS v2 runs in the browser — no new Vercel functions needed. Four new files are added (config.js, login.html, account.html, history.html). app.html gains a session check on load and a silent save after diagnosis. index.html CTAs are updated to point to login.html.

**Tech Stack:** Supabase JS v2 (CDN), Supabase Auth (Google OAuth), Supabase Storage (frames bucket), Supabase PostgreSQL (profiles + diagnoses tables), plain HTML/CSS/JS

---

## Pre-conditions (manual Supabase setup — do before any task)

These steps must be completed in the Supabase dashboard before running any task:

1. Create a Supabase project (free tier)
2. Run this SQL in the SQL editor:

```sql
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
  updated_at timestamptz default now()
);

create table diagnoses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamptz default now(),
  frame_url text,
  diagnosis text,
  likely_cause text,
  action_plan jsonb,
  safety_warnings jsonb,
  confidence text check (confidence in ('high','medium','low')),
  notes text
);

alter table profiles enable row level security;
create policy "own profile" on profiles
  for all using (auth.uid() = id);

alter table diagnoses enable row level security;
create policy "own diagnoses" on diagnoses
  for all using (auth.uid() = user_id);
```

3. Create storage bucket `frames` (public)
4. Run this SQL for storage RLS:

```sql
create policy "upload own frames" on storage.objects
  for insert with check (bucket_id = 'frames' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "read all frames" on storage.objects
  for select using (bucket_id = 'frames');
```

5. Authentication → Providers → Google: enable, add Client ID + Secret from Google Cloud Console
6. Authentication → URL Configuration: set Site URL to your Vercel URL and add redirect URL `https://YOUR_VERCEL_URL/account.html`
7. Note down: Project URL and anon public key (Settings → API)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `config.js` | Create | Shared Supabase credentials (public) |
| `login.html` | Create | Google sign-in page with session redirect |
| `account.html` | Create | Profile, New video CTA, My diagnoses, Logout |
| `history.html` | Create | Paginated diagnosis list with expandable rows |
| `app.html` | Modify | Session guard on load + silent saveDiagnosis after result |
| `index.html` | Modify | Both CTAs point to login.html |

---

## Task 1: config.js — Shared Supabase client config

**Files:**
- Create: `config.js`

- [ ] **Step 1: Create config.js with placeholder credentials**

```javascript
const SUPABASE_URL  = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_KEY';
```

- [ ] **Step 2: Verify the file exists and has the correct variable names**

Run: `cat config.js`
Expected: Both `SUPABASE_URL` and `SUPABASE_ANON` constants are present.

- [ ] **Step 3: Commit**

```bash
git add config.js
git commit -m "feat: add shared Supabase config"
```

**After this task:** Replace `YOUR_PROJECT.supabase.co` and `YOUR_ANON_KEY` with real values from the Supabase dashboard.

---

## Task 2: login.html — Google sign-in page

**Files:**
- Create: `login.html`

- [ ] **Step 1: Create login.html**

Full file content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0a0f1e">
  <title>PipeAI — Sign in</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0a0f1e; --surface: #111827; --border: #1f2937;
      --accent: #f97316; --accent-dark: #c2410c;
      --text: #f1f5f9; --muted: #94a3b8;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg); color: var(--text);
      min-height: 100dvh;
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
    }
    .card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 20px; padding: 40px 32px;
      max-width: 400px; width: 100%; text-align: center;
    }
    .logo { font-size: 1.75rem; font-weight: 700; margin-bottom: 8px; }
    .logo span { color: var(--accent); }
    .tagline { color: var(--muted); font-size: 0.9rem; margin-bottom: 36px; line-height: 1.5; }
    .btn-google {
      display: flex; align-items: center; justify-content: center; gap: 12px;
      width: 100%; padding: 14px 24px;
      background: white; color: #1a1a1a;
      border: none; border-radius: 12px;
      font-size: 1rem; font-weight: 600; font-family: inherit;
      cursor: pointer; text-decoration: none;
      transition: background 0.15s, transform 0.1s;
      touch-action: manipulation;
    }
    .btn-google:hover { background: #f5f5f5; }
    .btn-google:active { transform: scale(0.97); }
    .google-g {
      width: 20px; height: 20px; flex-shrink: 0;
    }
    .sub { margin-top: 20px; font-size: 0.8rem; color: var(--muted); }
    .error {
      margin-top: 16px; padding: 12px;
      background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
      border-radius: 8px; font-size: 0.85rem; color: #fca5a5;
      display: none;
    }
    .error.visible { display: block; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Pipe<span>AI</span></div>
    <p class="tagline">AI diagnostic assistant for field plumbers.<br>Your diagnoses are saved to your account.</p>
    <button class="btn-google" id="btn-google">
      <svg class="google-g" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Continue with Google →
    </button>
    <p class="sub">Your diagnoses are saved to your account.</p>
    <div class="error" id="error-msg">Sign-in failed. Please try again.</div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="config.js"></script>
  <script>
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { window.location.href = 'account.html'; }
    })();

    document.getElementById('btn-google').addEventListener('click', async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/account.html' }
      });
      if (error) {
        const el = document.getElementById('error-msg');
        el.classList.add('visible');
      }
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify file exists**

Run: `ls -la login.html`
Expected: File present, non-zero size.

- [ ] **Step 3: Commit**

```bash
git add login.html
git commit -m "feat: add Google sign-in page"
```

---

## Task 3: account.html — Profile + navigation hub

**Files:**
- Create: `account.html`

- [ ] **Step 1: Create account.html**

Full file content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0a0f1e">
  <title>PipeAI — My Account</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0a0f1e; --surface: #111827; --border: #1f2937;
      --accent: #f97316; --accent-dark: #c2410c;
      --text: #f1f5f9; --muted: #94a3b8;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg); color: var(--text);
      min-height: 100dvh;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 40px 24px; gap: 40px;
      visibility: hidden;
    }
    /* Profile */
    .profile { display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .avatar-wrap {
      position: relative; width: 80px; height: 80px; cursor: pointer;
    }
    .avatar {
      width: 80px; height: 80px; border-radius: 50%;
      object-fit: cover; border: 2px solid var(--border);
      background: var(--surface);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.75rem; font-weight: 700; color: var(--accent);
      overflow: hidden;
    }
    .avatar img { width: 100%; height: 100%; object-fit: cover; display: none; border-radius: 50%; }
    .avatar-wrap:hover .avatar { border-color: var(--accent); }
    .avatar-hint { font-size: 0.7rem; color: var(--muted); margin-top: 4px; }
    .name-wrap { display: flex; align-items: center; gap: 8px; }
    .display-name { font-size: 1.1rem; font-weight: 600; }
    .name-input {
      font-size: 1.1rem; font-weight: 600; font-family: inherit;
      background: var(--surface); border: 1px solid var(--accent);
      border-radius: 8px; color: var(--text); padding: 4px 10px;
      display: none; outline: none;
    }
    .name-edit-btn {
      background: none; border: none; cursor: pointer;
      color: var(--muted); font-size: 0.85rem; padding: 4px;
    }
    .name-edit-btn:hover { color: var(--text); }
    /* Buttons */
    .btn {
      display: block; width: 100%; max-width: 320px;
      padding: 16px 24px; border: none; border-radius: 14px;
      font-size: 1rem; font-weight: 700; font-family: inherit;
      cursor: pointer; text-decoration: none; text-align: center;
      transition: background 0.15s, transform 0.1s;
      touch-action: manipulation;
    }
    .btn:active { transform: scale(0.97); }
    .btn-primary { background: var(--accent); color: white; font-size: 1.15rem; }
    .btn-primary:hover { background: var(--accent-dark); }
    .btn-secondary {
      background: var(--surface); color: var(--text);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover { border-color: var(--muted); }
    .row { display: flex; gap: 12px; width: 100%; max-width: 320px; }
    .row .btn { max-width: none; }
    #file-input { display: none; }
  </style>
</head>
<body>
  <div class="profile">
    <div class="avatar-wrap" id="avatar-wrap" title="Tap to change photo">
      <div class="avatar" id="avatar-el">
        <span id="avatar-initials">?</span>
        <img id="avatar-img" alt="avatar">
      </div>
    </div>
    <small class="avatar-hint">Tap photo to change</small>
    <div class="name-wrap">
      <span class="display-name" id="display-name-text">Loading...</span>
      <input class="name-input" id="name-input" type="text" maxlength="60" placeholder="Your name">
      <button class="name-edit-btn" id="name-edit-btn" title="Edit name">✏️</button>
    </div>
  </div>

  <a href="app.html" class="btn btn-primary">New video →</a>

  <div class="row">
    <a href="history.html" class="btn btn-secondary">My diagnoses</a>
    <button id="btn-logout" class="btn btn-secondary">Log out</button>
  </div>

  <input type="file" id="file-input" accept="image/*">

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="config.js"></script>
  <script>
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    let userId = null;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = 'login.html'; return; }
      userId = session.user.id;
      document.body.style.visibility = 'visible';
      await loadProfile(session.user);
    })();

    async function loadProfile(user) {
      let { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (!profile) {
        await supabase.from('profiles').insert({ id: userId, display_name: null });
        profile = { display_name: null, avatar_url: null };
      }
      const name = profile.display_name || user.user_metadata?.full_name || user.email || 'You';
      setDisplayName(name);
      if (profile.avatar_url) {
        setAvatar(profile.avatar_url);
      } else {
        document.getElementById('avatar-initials').textContent = name.charAt(0).toUpperCase();
      }
    }

    function setDisplayName(name) {
      document.getElementById('display-name-text').textContent = name;
      document.getElementById('name-input').value = name;
    }

    function setAvatar(url) {
      const img = document.getElementById('avatar-img');
      img.src = url;
      img.style.display = 'block';
      document.getElementById('avatar-initials').style.display = 'none';
    }

    // Edit name
    document.getElementById('name-edit-btn').addEventListener('click', () => {
      document.getElementById('display-name-text').style.display = 'none';
      const input = document.getElementById('name-input');
      input.style.display = 'inline-block';
      input.focus();
    });

    async function saveName() {
      const input = document.getElementById('name-input');
      const name = input.value.trim() || 'You';
      input.style.display = 'none';
      document.getElementById('display-name-text').style.display = 'inline';
      setDisplayName(name);
      await supabase.from('profiles').update({ display_name: name, updated_at: new Date().toISOString() }).eq('id', userId);
    }

    document.getElementById('name-input').addEventListener('blur', saveName);
    document.getElementById('name-input').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });

    // Avatar upload
    document.getElementById('avatar-wrap').addEventListener('click', () => {
      document.getElementById('file-input').click();
    });

    document.getElementById('file-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const path = userId + '/avatar.jpg';
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
        setAvatar(publicUrl + '?t=' + Date.now());
        await supabase.from('profiles').update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', userId);
      }
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = 'login.html';
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify file exists**

Run: `ls -la account.html`
Expected: File present, non-zero size.

- [ ] **Step 3: Commit**

```bash
git add account.html
git commit -m "feat: add account page with profile and navigation"
```

---

## Task 4: history.html — Diagnosis history list

**Files:**
- Create: `history.html`

- [ ] **Step 1: Create history.html**

Full file content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0a0f1e">
  <title>PipeAI — My Diagnoses</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0a0f1e; --surface: #111827; --border: #1f2937;
      --accent: #f97316; --accent-dark: #c2410c;
      --text: #f1f5f9; --muted: #94a3b8;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg); color: var(--text);
      padding-bottom: 88px;
      visibility: hidden;
    }
    header {
      padding: 24px 20px 16px;
      border-bottom: 1px solid var(--border);
    }
    header h1 { font-size: 1.3rem; font-weight: 700; }
    .list { padding: 0 0 16px; }
    .row {
      border-bottom: 1px solid var(--border);
      cursor: pointer;
    }
    .row-summary {
      display: flex; align-items: center; gap: 14px;
      padding: 14px 20px;
    }
    .thumb {
      width: 56px; height: 56px; border-radius: 10px;
      object-fit: cover; background: var(--surface); flex-shrink: 0;
      border: 1px solid var(--border);
    }
    .thumb-placeholder {
      width: 56px; height: 56px; border-radius: 10px;
      background: var(--surface); flex-shrink: 0;
      border: 1px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.5rem;
    }
    .meta { flex: 1; min-width: 0; }
    .diag-text {
      font-size: 0.9rem; font-weight: 600;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .date { font-size: 0.75rem; color: var(--muted); margin-top: 3px; }
    .chevron { color: var(--muted); font-size: 0.9rem; transition: transform 0.2s; }
    .row.expanded .chevron { transform: rotate(90deg); }
    .detail {
      display: none; padding: 0 20px 16px;
    }
    .row.expanded .detail { display: block; }
    .detail-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px;
    }
    .detail-section-title { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
    .detail-body { font-size: 0.875rem; line-height: 1.6; }
    .step-item { display: flex; gap: 10px; font-size: 0.875rem; line-height: 1.5; margin-bottom: 6px; }
    .step-num { color: var(--accent); font-weight: 700; flex-shrink: 0; }
    .confidence {
      display: inline-block; padding: 2px 10px;
      border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
    }
    .confidence-high { background: rgba(34,197,94,0.15); color: #86efac; }
    .confidence-medium { background: rgba(234,179,8,0.15); color: #fde047; }
    .confidence-low { background: rgba(239,68,68,0.15); color: #fca5a5; }
    .empty {
      text-align: center; padding: 80px 24px;
      color: var(--muted); font-size: 0.95rem; line-height: 1.7;
    }
    .bottom-bar {
      position: fixed; bottom: 0; left: 0; right: 0;
      padding: 16px 20px;
      background: var(--bg); border-top: 1px solid var(--border);
    }
    .btn-new {
      display: block; width: 100%; max-width: 480px; margin: 0 auto;
      padding: 16px 24px; background: var(--accent); color: white;
      border: none; border-radius: 14px;
      font-size: 1rem; font-weight: 700; font-family: inherit;
      cursor: pointer; text-decoration: none; text-align: center;
      transition: background 0.15s, transform 0.1s;
      touch-action: manipulation;
    }
    .btn-new:hover { background: var(--accent-dark); }
    .btn-new:active { transform: scale(0.97); }
  </style>
</head>
<body>
  <header><h1>My diagnoses</h1></header>
  <div class="list" id="list"></div>
  <div class="bottom-bar">
    <a href="app.html" class="btn-new">New video →</a>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="config.js"></script>
  <script>
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = 'login.html'; return; }
      document.body.style.visibility = 'visible';
      await loadHistory();
    })();

    function relativeDate(iso) {
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return mins + ' min ago';
      const hours = Math.floor(mins / 60);
      if (hours < 24) return hours + ' hr ago';
      const days = Math.floor(hours / 24);
      if (days < 7) return days + ' day' + (days > 1 ? 's' : '') + ' ago';
      return new Date(iso).toLocaleDateString();
    }

    function confidenceClass(c) {
      if (c === 'high') return 'confidence-high';
      if (c === 'low') return 'confidence-low';
      return 'confidence-medium';
    }

    function buildRow(d) {
      const row = document.createElement('div');
      row.className = 'row';

      // Summary line
      const summary = document.createElement('div');
      summary.className = 'row-summary';

      if (d.frame_url) {
        const img = document.createElement('img');
        img.className = 'thumb';
        img.src = d.frame_url;
        img.alt = 'frame';
        summary.appendChild(img);
      } else {
        const ph = document.createElement('div');
        ph.className = 'thumb-placeholder';
        ph.textContent = '🔧';
        summary.appendChild(ph);
      }

      const meta = document.createElement('div');
      meta.className = 'meta';

      const diagText = document.createElement('div');
      diagText.className = 'diag-text';
      diagText.textContent = d.diagnosis || 'Diagnosis';
      meta.appendChild(diagText);

      const dateEl = document.createElement('div');
      dateEl.className = 'date';
      dateEl.textContent = relativeDate(d.created_at);
      meta.appendChild(dateEl);

      summary.appendChild(meta);

      const chevron = document.createElement('span');
      chevron.className = 'chevron';
      chevron.textContent = '›';
      summary.appendChild(chevron);

      row.appendChild(summary);

      // Detail panel
      const detail = document.createElement('div');
      detail.className = 'detail';

      const card = document.createElement('div');
      card.className = 'detail-card';

      // Diagnosis
      const dTitle = document.createElement('div');
      dTitle.className = 'detail-section-title';
      dTitle.textContent = 'Diagnosis';
      card.appendChild(dTitle);
      const dBody = document.createElement('div');
      dBody.className = 'detail-body';
      dBody.textContent = d.diagnosis || '';
      card.appendChild(dBody);

      // Likely cause
      if (d.likely_cause) {
        const lcTitle = document.createElement('div');
        lcTitle.className = 'detail-section-title';
        lcTitle.textContent = 'Likely cause';
        card.appendChild(lcTitle);
        const lcBody = document.createElement('div');
        lcBody.className = 'detail-body';
        lcBody.textContent = d.likely_cause;
        card.appendChild(lcBody);
      }

      // Action plan
      const steps = Array.isArray(d.action_plan) ? d.action_plan : [];
      if (steps.length) {
        const apTitle = document.createElement('div');
        apTitle.className = 'detail-section-title';
        apTitle.textContent = 'Action plan';
        card.appendChild(apTitle);
        steps.forEach((s, i) => {
          const item = document.createElement('div');
          item.className = 'step-item';
          const num = document.createElement('span');
          num.className = 'step-num';
          num.textContent = (i + 1) + '.';
          item.appendChild(num);
          const txt = document.createElement('span');
          txt.textContent = s.action || s.step || JSON.stringify(s);
          item.appendChild(txt);
          card.appendChild(item);
        });
      }

      // Safety warnings
      const warnings = Array.isArray(d.safety_warnings) ? d.safety_warnings : [];
      if (warnings.length) {
        const swTitle = document.createElement('div');
        swTitle.className = 'detail-section-title';
        swTitle.textContent = 'Safety warnings';
        card.appendChild(swTitle);
        warnings.forEach(w => {
          const wEl = document.createElement('div');
          wEl.className = 'detail-body';
          wEl.textContent = '⚠️ ' + (typeof w === 'string' ? w : JSON.stringify(w));
          card.appendChild(wEl);
        });
      }

      // Confidence
      if (d.confidence) {
        const confEl = document.createElement('span');
        confEl.className = 'confidence ' + confidenceClass(d.confidence);
        confEl.textContent = d.confidence + ' confidence';
        card.appendChild(confEl);
      }

      // Notes
      if (d.notes) {
        const nTitle = document.createElement('div');
        nTitle.className = 'detail-section-title';
        nTitle.textContent = 'Notes';
        card.appendChild(nTitle);
        const nBody = document.createElement('div');
        nBody.className = 'detail-body';
        nBody.textContent = d.notes;
        card.appendChild(nBody);
      }

      detail.appendChild(card);
      row.appendChild(detail);

      // Toggle expand
      summary.addEventListener('click', () => {
        row.classList.toggle('expanded');
      });

      return row;
    }

    async function loadHistory() {
      const list = document.getElementById('list');

      const { data: diagnoses, error } = await supabase
        .from('diagnoses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !diagnoses || diagnoses.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'No diagnoses yet. Tap New video to get started.';
        list.appendChild(empty);
        return;
      }

      diagnoses.forEach(d => {
        list.appendChild(buildRow(d));
      });
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify file exists**

Run: `ls -la history.html`
Expected: File present, non-zero size.

- [ ] **Step 3: Commit**

```bash
git add history.html
git commit -m "feat: add diagnosis history page"
```

---

## Task 5: app.html — Session guard + saveDiagnosis

**Files:**
- Modify: `app.html`

- [ ] **Step 1: Read current app.html to find injection points**

Read `app.html` and locate:
1. The opening `<head>` tag (for Supabase CDN + config.js)
2. The `<body>` opening tag (add `style="visibility:hidden"`)
3. The top of the `<script>` block (for session guard)
4. The line `renderResult(r);` (for saveDiagnosis call)
5. The end of the script (for saveDiagnosis function)

- [ ] **Step 2: Add Supabase CDN + config.js to head**

In `app.html`, find the closing `</head>` tag and add BEFORE it:

```html
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="config.js"></script>
```

- [ ] **Step 3: Add visibility:hidden to body**

Change: `<body>`
To: `<body style="visibility:hidden">`

- [ ] **Step 4: Add session guard at the top of the script block**

Find the opening `<script>` tag of the main script block and add these lines immediately after it:

```javascript
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
let _userId = null;
(async () => {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  _userId = session.user.id;
  document.body.style.visibility = 'visible';
})();
```

- [ ] **Step 5: Call saveDiagnosis after renderResult**

Find this line:
```javascript
renderResult(r);
```

Change it to:
```javascript
renderResult(r);
saveDiagnosis(r, extractedFrames[0]);
```

- [ ] **Step 6: Add saveDiagnosis function before closing script tag**

Add this function before `</script>`:

```javascript
async function saveDiagnosis(r, firstFrameB64) {
  try {
    if (!_userId || !firstFrameB64) return;
    const diagId = crypto.randomUUID();
    const byteChars = atob(firstFrameB64);
    const byteNums  = new Array(byteChars.length).fill(0).map((_, i) => byteChars.charCodeAt(i));
    const blob = new Blob([new Uint8Array(byteNums)], { type: 'image/jpeg' });
    const path = _userId + '/' + diagId + '.jpg';
    await _supabase.storage.from('frames').upload(path, blob, { contentType: 'image/jpeg' });
    const { data: { publicUrl } } = _supabase.storage.from('frames').getPublicUrl(path);
    await _supabase.from('diagnoses').insert({
      id: diagId,
      user_id: _userId,
      frame_url: publicUrl,
      diagnosis:       r.diagnosis,
      likely_cause:    r.likely_cause,
      action_plan:     r.action_plan,
      safety_warnings: r.safety_warnings,
      confidence:      r.confidence,
      notes:           r.notes
    });
  } catch (err) {
    console.warn('[saveDiagnosis] silent failure:', err);
  }
}
```

- [ ] **Step 7: Verify app.html still valid**

Run: `grep -n "visibility:hidden\|SUPABASE_URL\|saveDiagnosis\|_userId" app.html | head -20`
Expected: All four identifiers appear.

- [ ] **Step 8: Commit**

```bash
git add app.html
git commit -m "feat: add session guard and silent diagnosis save to app"
```

---

## Task 6: index.html — Update CTAs to login.html

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Update both CTA links**

In `index.html`, find:
```html
<a href="app.html" class="btn btn-primary">Try it now →</a>
```

There are two of these (hero section + footer CTA). Change both to:
```html
<a href="login.html" class="btn btn-primary">Try it now →</a>
```

Also update the footer CTA paragraph copy to match the new logged-in context:

Find:
```html
<p>No account required. Open your camera, describe the problem, get your answer.</p>
```

Change to:
```html
<p>Sign in with Google. Open your camera, describe the problem, get your answer.</p>
```

- [ ] **Step 2: Verify both links updated**

Run: `grep -n "Try it now" index.html`
Expected: Two lines, both pointing to `login.html`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: update landing page CTAs to route through login"
```

---

## Task 7: End-to-end verification on Vercel

**Files:** None — verification only

- [ ] **Step 1: Push branch to GitHub**

```bash
git push origin feature/phase1-poc
```

- [ ] **Step 2: Wait for Vercel deployment**

Vercel auto-deploys on push. Check the Vercel dashboard for deploy status. Wait until green.

- [ ] **Step 3: Verify config.js has real credentials**

Open `config.js` and confirm `SUPABASE_URL` and `SUPABASE_ANON` contain real values (not placeholder strings).

If they still contain placeholders, update them now before testing:
- Copy Project URL from Supabase → Settings → API → Project URL
- Copy anon public key from Supabase → Settings → API → anon public

- [ ] **Step 4: Test the full auth flow on the Vercel URL**

Open the deployed Vercel URL and walk through:

1. `index.html` loads → "Try it now →" clicks → lands on `login.html` ✓
2. `login.html` → "Continue with Google →" → Google OAuth → lands on `account.html` ✓
3. `account.html` shows avatar + display name loaded from Supabase ✓
4. "New video →" → `app.html` loads (no redirect to login.html) ✓
5. Record a short video, receive diagnosis ✓
6. Supabase → Table Editor → diagnoses: new row appears ✓
7. Supabase → Storage → frames: JPEG thumbnail uploaded ✓
8. `account.html` → "My diagnoses" → `history.html` shows the row ✓
9. Tap row → expands to show full diagnosis ✓
10. "Log out" → redirects to `login.html`, session cleared ✓
11. Navigate to `app.html` directly → redirects to `login.html` ✓

- [ ] **Step 5: Commit verification note**

```bash
git commit --allow-empty -m "chore: verified end-to-end auth+history flow on Vercel"
```

---

## Self-Review Checklist

**Spec coverage:**
- config.js (shared credentials) → Task 1 ✓
- login.html (Google OAuth, session redirect, error state) → Task 2 ✓
- account.html (profile, avatar, name edit, navigation) → Task 3 ✓
- history.html (list, thumbnails, expandable, empty state, fixed bar) → Task 4 ✓
- app.html (session guard, visibility:hidden, saveDiagnosis) → Task 5 ✓
- index.html CTA update → Task 6 ✓
- avatars bucket RLS → listed in pre-conditions (manual Supabase setup)
- End-to-end test → Task 7 ✓

**Placeholder scan:** No TBDs or TODOs in task steps.

**Type consistency:**
- `_supabase` (app.html), `supabase` (other pages) — consistent within each file
- `_userId` used in app.html, `userId` in account.html — consistent within each file
- `SUPABASE_URL` / `SUPABASE_ANON` from config.js — used consistently across all pages
- `saveDiagnosis(r, extractedFrames[0])` — `extractedFrames` matches the variable name in existing app.html
