# Ascend — AI-Powered Mock Interview & Resume Assessment Platform

> A production-grade, full-stack platform that conducts AI-driven mock interviews and resume analysis using AWS Bedrock (LLM), Murf AI (TTS), Deepgram (STT), MediaPipe (client-side CV), and Supabase (auth + database).

---

## Architecture Overview

```
[Browser]
  ├── MediaPipe WASM (eye gaze + posture — zero server upload)
  ├── Web Speech API / Deepgram (live & audio STT transcription)
  └── Audio Player (Murf AI Iris voice TTS playback)
        │
        ▼
[Next.js Frontend]  ──── REST/WS ────►  [Node.js/Express Backend]
                                                  │
                                    ┌─────────────┼─────────────┐
                                    ▼             ▼             ▼
                              [AWS Bedrock]   [Murf AI]    [Supabase]
                              (Nova/Llama3)   (TTS API)   (DB + Auth)
                                                  │
                                                  ▼
                                             [Deepgram]
                                             (Nova-2 STT)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (Pages Router) + TypeScript + Tailwind CSS |
| Client CV | MediaPipe FaceMesh + Pose (WASM, ~30fps, no video upload) |
| Backend | Node.js + Express + TypeScript |
| LLM | AWS Bedrock — Amazon Nova Pro / Meta Llama 3 |
| TTS | Murf AI API (Iris voice) |
| STT | Web Speech API (client-side) + Deepgram Nova-2 (server-side STT) |
| Auth | Supabase Auth (OAuth 2.0 + Email Magic Links) |
| Database | Supabase PostgreSQL |
| Storage | Supabase Storage (resume PDFs) |

---

## Project Structure

```
Ascend/
├── client/                   # Next.js frontend
│   └── src/
│       ├── components/       # UI component library
│       ├── hooks/            # useVideoCapture, useSpeechToText, useAudioPlayer
│       ├── pages/            # index, dashboard, interview, assessment, results
│       ├── services/         # API layer (axios)
│       ├── types/            # TypeScript interfaces
│       └── utils/            # cvThresholds, formatters
├── server/                   # Express backend
│   └── src/
│       ├── config/           # AWS Bedrock, Supabase, env validation
│       ├── controllers/      # resume, assessment, interview, auth
│       ├── middleware/       # JWT auth, error handler, multer upload
│       ├── routes/           # API route definitions
│       ├── services/         # bedrockService, ttsService, sttService
│       └── utils/            # PDF parser, prompt templates (HR + Tech)
├── supabase/
│   └── schema.sql            # Full DB schema with RLS policies
└── README.md
```

---

## Quick Start

### Prerequisites
- Node.js ≥ 20.x
- Supabase project (free tier works)
- AWS account with Bedrock access (Nova Pro model enabled)
- Murf AI API key
- Deepgram API key

### 1. Clone & Install

```bash
# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Configure Environment

```bash
# Server
cp server/.env.example server/.env
# Fill in: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AWS credentials, MURF_API_KEY, DEEPGRAM_API_KEY

# Client
cp client/.env.local.example client/.env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_BASE_URL
```

### 3. Run Database Migrations

```
Open Supabase Dashboard > SQL Editor > paste contents of supabase/schema.sql > Run
```

### 4. Create Storage Bucket

```
Supabase Dashboard > Storage > New Bucket > Name: "resumes" > Private
```

### 5. Start Development Servers

```bash
# Terminal 1 — Backend (port 5001)
cd server && npm run dev

# Terminal 2 — Frontend (port 3000)
cd client && npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Key Flows

### Resume Analysis (Guest)
1. User uploads resume PDF → backend extracts text via `pdf-parse`
2. Text sent to AWS Bedrock → returns ATS score + keyword summary JSON
3. Preliminary results rendered → login gate modal blocks deep metrics

### AI Mock Interview
1. User provides job description + selects judge mode (Technical / HR)
2. Backend assembles prompt: `resume + jobDescription + judgeType` → Bedrock
3. Bedrock returns 5–8 structured interview questions as JSON
4. Each question → ElevenLabs TTS → audio plays in browser
5. User speaks → Web Speech API captures transcript in real-time
6. After each answer → STT text sent to backend → Bedrock evaluates + generates next question
7. Client-side MediaPipe tracks eye gaze and posture (no video leaves browser)
8. On completion → demeanor telemetry JSON + transcripts sent to backend → final scoring

### MCQ Assessment
1. Backend generates 10 MCQ questions via Bedrock based on job description
2. Single-question SPA interface with free back/forward navigation
3. Submit button unlocks only after visiting final question
4. On submit → backend evaluates answers + generates feedback via Bedrock

---

## Environment Variables Reference

### Server (`server/.env`)
| Variable | Description |
|---|---|
| `PORT` | Server port (default: 5001) |
| `CLIENT_ORIGIN` | Frontend URL for CORS |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin) |
| `AWS_REGION` | AWS region for Bedrock |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `BEDROCK_MODEL_ID` | Model ID (amazon.nova-pro-v1:0) |
| `ELEVENLABS_API_KEY` | ElevenLabs API key |
| `ELEVENLABS_VOICE_ID` | Voice ID for AI interviewer |
| `OPENAI_API_KEY` | Optional: Whisper STT fallback |

### Client (`client/.env.local`)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_API_BASE_URL` | Backend URL (http://localhost:5001) |
