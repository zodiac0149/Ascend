-- ============================================================
-- Ascend Platform — Supabase PostgreSQL Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  full_name    TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. ASSESSMENTS (MCQ test sessions)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.assessments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_description  TEXT NOT NULL,
  judge_type       TEXT NOT NULL CHECK (judge_type IN ('technical', 'hr')),
  resume_url       TEXT,
  resume_text      TEXT,
  questions        JSONB NOT NULL DEFAULT '[]',
  user_answers     JSONB NOT NULL DEFAULT '{}',
  raw_score        NUMERIC(5,2),
  total_questions  INTEGER NOT NULL DEFAULT 0,
  correct_answers  INTEGER NOT NULL DEFAULT 0,
  llm_feedback     JSONB,
  status           TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON public.assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_created_at ON public.assessments(created_at DESC);

CREATE TRIGGER set_assessments_completed
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. INTERVIEW SESSIONS (AI mock interview sessions)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.interview_sessions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  judge_type           TEXT NOT NULL CHECK (judge_type IN ('technical', 'hr')),
  job_description      TEXT NOT NULL,
  resume_url           TEXT,
  resume_text          TEXT,

  -- Conversation: array of {role, content, timestamp, question_index}
  transcript           JSONB NOT NULL DEFAULT '[]',

  -- CV telemetry from client-side MediaPipe (no raw video ever stored)
  demeanor_telemetry   JSONB NOT NULL DEFAULT '{
    "eyeContactLossCount": 0,
    "poorPostureDuration": 0,
    "postureAlertCount": 0,
    "gazeOffScreenDuration": 0,
    "eyeContactPercent": 100
  }',

  -- Scoring
  content_score        NUMERIC(5,2),
  demeanor_score       NUMERIC(5,2),
  overall_score        NUMERIC(5,2),
  llm_feedback         JSONB,

  status               TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id ON public.interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_created_at ON public.interview_sessions(created_at DESC);

-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;

-- profiles: users can only see and edit their own
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- assessments: users own their rows
CREATE POLICY "Users can view own assessments"
  ON public.assessments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own assessments"
  ON public.assessments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assessments"
  ON public.assessments FOR UPDATE USING (auth.uid() = user_id);

-- interview_sessions: users own their rows
CREATE POLICY "Users can view own interview sessions"
  ON public.interview_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own interview sessions"
  ON public.interview_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own interview sessions"
  ON public.interview_sessions FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 5. SUPABASE STORAGE BUCKETS
-- ============================================================
-- Run in Supabase Dashboard > Storage, or via API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);

-- Storage policy: users can upload to their own folder resumes/{user_id}/
-- (Configure in Supabase Dashboard > Storage > resumes > Policies)
