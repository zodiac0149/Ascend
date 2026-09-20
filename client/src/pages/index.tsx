import React, { useState, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { analyzeResume } from '@/services/interviewService';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '@/services/authService';
import type { ResumeAnalysis } from '@/types/interview';

type AuthMode = 'signin' | 'signup';

export default function Home() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    onDrop: (acceptedFiles) => setFile(acceptedFiles[0] ?? null),
    onDropRejected: () => toast.error('Please upload a valid PDF file (max 5MB).'),
  });

  const handleAnalyze = async () => {
    if (!file) { toast.error('Please upload your resume first.'); return; }
    setIsAnalyzing(true);
    try {
      const result = await analyzeResume(file);
      setAnalysis(result);
    } catch (err) {
      toast.error((err as Error).message || 'Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    try {
      if (authMode === 'signup') {
        const { error } = await signUpWithEmail(email, password, fullName);
        if (error) throw error;
        toast.success('Account created! Please check your email to confirm.');
      } else {
        const { error } = await signInWithEmail(email, password);
        if (error) throw error;
        toast.success('Welcome back!');
        router.push('/dashboard');
      }
      setShowAuthModal(false);
    } catch (err) {
      toast.error((err as Error).message || 'Authentication failed.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsAuthLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      toast.error((err as Error).message);
      setIsAuthLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Ascend — AI-Powered Interview & Resume Assessment</title>
        <meta name="description"
          content="Ace your next interview with AI-powered mock interviews, resume analysis, and skill assessments. Real-time feedback powered by AWS Bedrock." />
      </Head>

      <div className="page-container relative overflow-hidden">
        {/* Hero glow */}
        <div className="hero-glow" />

        {/* Navigation */}
        <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5 border-b border-surface-border/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center">
              <span className="text-white font-black text-sm">A</span>
            </div>
            <span className="text-xl font-bold gradient-text">Ascend</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => { setAuthMode('signin'); setShowAuthModal(true); }}>
              Sign In
            </Button>
            <Button variant="primary" size="sm" onClick={() => { setAuthMode('signup'); setShowAuthModal(true); }}>
              Get Started
            </Button>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative z-10 flex flex-col items-center text-center px-6 pt-16 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold
                             bg-brand-500/10 border border-brand-500/20 text-brand-400 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
              AI-Powered Career Preparation
            </span>
            <h1 className="text-4xl md:text-6xl font-black text-text-primary leading-tight mb-4">
              Land your{' '}
              <span className="gradient-text">dream role</span>
              <br />with AI coaching
            </h1>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-8">
              Practice interviews with an AI judge that adapts to your resume. Get real-time
              feedback on your answers, eye contact, and delivery — no human required.
            </p>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex flex-wrap justify-center gap-3 mb-12"
          >
            {[
              { icon: '🤖', text: 'AWS Bedrock LLM' },
              { icon: '🎙️', text: 'ElevenLabs Voice AI' },
              { icon: '👁️', text: 'MediaPipe CV' },
              { icon: '📊', text: 'ATS Resume Scoring' },
            ].map((pill) => (
              <span key={pill.text}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm
                           bg-surface-700/50 border border-surface-border text-text-secondary">
                <span>{pill.icon}</span>
                {pill.text}
              </span>
            ))}
          </motion.div>
        </section>

        {/* Resume Upload Section */}
        <section className="relative z-10 px-6 md:px-12 pb-16 max-w-3xl mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-8"
          >
            <h2 className="text-xl font-bold text-text-primary mb-2">
              Start with your resume
            </h2>
            <p className="text-text-secondary text-sm mb-6">
              Upload your resume PDF to get an instant ATS compatibility score — no account required.
            </p>

            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-xl p-10 text-center cursor-pointer
                transition-all duration-200
                ${isDragActive
                  ? 'border-brand-500 bg-brand-500/10'
                  : file
                  ? 'border-accent-500/50 bg-accent-500/5'
                  : 'border-surface-border hover:border-brand-500/50 hover:bg-brand-500/5'
                }
              `}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-3">
                {file ? (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-accent-500/15 flex items-center justify-center">
                      <svg className="w-6 h-6 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="font-semibold text-text-primary text-sm">{file.name}</p>
                    <p className="text-text-muted text-xs">
                      {(file.size / 1024).toFixed(1)} KB · Click to change
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-surface-600 flex items-center justify-center">
                      <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary text-sm">
                        {isDragActive ? 'Drop your resume here' : 'Drag & drop your resume'}
                      </p>
                      <p className="text-text-muted text-xs mt-1">PDF only, max 5MB</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <Button
              variant="primary"
              className="w-full mt-4"
              onClick={handleAnalyze}
              loading={isAnalyzing}
              disabled={!file}
            >
              Analyse Resume
            </Button>
          </motion.div>

          {/* Analysis Results */}
          <AnimatePresence>
            {analysis && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-6 glass-card p-6"
              >
                {/* ATS Score */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-text-primary">ATS Compatibility Score</h3>
                    <p className="text-text-muted text-sm">Preliminary analysis</p>
                  </div>
                  <div className={`text-4xl font-black ${
                    analysis.atsScore >= 70 ? 'text-emerald-400' :
                    analysis.atsScore >= 50 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {analysis.atsScore}
                    <span className="text-lg font-semibold text-text-muted">%</span>
                  </div>
                </div>

                <p className="text-text-secondary text-sm mb-4">{analysis.summary}</p>

                {/* Keyword matches (preview) */}
                {analysis.keywordMatches.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                      Matched Keywords
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.keywordMatches.slice(0, 5).map((kw) => (
                        <span key={kw} className="px-2.5 py-1 rounded-full text-xs font-medium
                                                   bg-accent-500/10 text-accent-500 border border-accent-500/20">
                          {kw}
                        </span>
                      ))}
                      {analysis.keywordMatches.length > 5 && (
                        <span className="px-2.5 py-1 rounded-full text-xs text-text-muted bg-surface-700">
                          +{analysis.keywordMatches.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Login gate for deep metrics */}
                <div className="relative">
                  <div className="blur-sm pointer-events-none select-none p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                      Missing Keywords & Full Report
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {['●●●●●', '●●●', '●●●●'].map((p, i) => (
                        <span key={i} className="px-3 py-1 rounded-full text-xs bg-red-500/10 text-red-400 border border-red-500/20">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center
                                  bg-surface-900/70 backdrop-blur-[2px] rounded-xl border border-surface-border">
                    <p className="text-sm font-semibold text-text-primary mb-3">
                      Create a free account to unlock the full report
                    </p>
                    <Button variant="primary" size="sm"
                      onClick={() => { setAuthMode('signup'); setShowAuthModal(true); }}>
                      Get Full Report →
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Auth Modal */}
        <Modal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          title={authMode === 'signin' ? 'Welcome back' : 'Create your account'}
          subtitle={authMode === 'signin'
            ? 'Sign in to access your dashboard and interview history'
            : 'Free forever. No credit card required.'}
        >
          <form onSubmit={handleAuth} className="flex flex-col gap-4">
            {authMode === 'signup' && (
              <input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-base"
                required
              />
            )}
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-base"
              required
              minLength={8}
            />

            <Button type="submit" variant="primary" className="w-full" loading={isAuthLoading}>
              {authMode === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-surface-border" />
              </div>
              <div className="relative flex justify-center text-xs text-text-muted bg-surface-700/60 px-3">
                or continue with
              </div>
            </div>

            <Button type="button" variant="secondary" className="w-full" onClick={handleGoogleAuth}
              leftIcon={
                <svg viewBox="0 0 24 24" className="w-4 h-4">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              }
            >
              Continue with Google
            </Button>

            <p className="text-center text-sm text-text-muted">
              {authMode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                className="text-brand-400 font-semibold hover:underline"
              >
                {authMode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </form>
        </Modal>
      </div>
    </>
  );
}
