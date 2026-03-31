# PipeAI — Product Brief (MVP v1)

## Goal

Give field plumbers an always-available AI assistant that watches their video footage, listens to their spoken context, and returns precise, actionable recommendations — cutting diagnostic time, reducing costly errors, and enabling less experienced plumbers to work at a higher level without waiting for a senior colleague.

## Target User

**Independent & small-team plumbers** — on-site professionals handling residential and commercial jobs, often alone, under time pressure, with no quick access to a mentor or reference manual. They own a smartphone, wear work gloves, and need answers in seconds, not minutes.

## Core Features

### 1. Video + Voice Capture
Record directly in the browser. The plumber speaks freely while filming — the AI processes both the visual scene and the spoken description together for richer diagnostic context.

### 2. AI Diagnostic Analysis
Multimodal analysis identifies pipe types, fault patterns, pressure indicators, and potential hazards — then maps them to likely causes and repair paths.

### 3. Step-by-Step Recommendations
Structured, prioritised action plan with tool requirements, safety warnings, and alternative approaches — tailored to what was seen and said in the recording.

## MVP Scope

- Web app only (no native mobile app)
- No authentication required
- Mobile-first UI (usable with one gloved hand)
- Single session — no history or saved results
- No user accounts or backend storage

## What Success Looks Like

| Metric | Target |
|---|---|
| Time from recording end to first recommendation | < 60 seconds |
| UI accessibility | Full flow reachable with one hand |
| User validation | 80%+ of plumbers find advice actionable on first use |

**The north star scenario:** A plumber films a leaking joint for 20 seconds, briefly describes the building age and water pressure, and receives a ranked action plan with part references and safety notes — without touching a keyboard, creating an account, or leaving the job site.

## Key Technical Risk

The toughest challenge will be video analysis quality — specifically whether the AI can reliably distinguish pipe materials, joint types, and leak signatures in real-world conditions (low light, cramped spaces, dirty pipes). This is the primary assumption to validate early.

## Tech Stack Recommendations (for Claude Code)

- **Frontend:** Single-page web app (React or plain HTML/JS)
- **Video capture:** Browser `MediaRecorder` API
- **Speech:** Browser `SpeechRecognition` API or audio track extraction
- **AI analysis:** Anthropic Claude API (multimodal — video frames + transcribed audio)
- **No backend required for v1** — all processing client-side or direct API calls
