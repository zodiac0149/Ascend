import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getCurrentUser, signOut } from '@/services/authService';
import { getInterviewHistory } from '@/services/interviewService';
import { getAssessmentHistory } from '@/services/resumeService';
import { HistoryTable } from '@/components/dashboard/HistoryTable';
import { Button } from '@/components/ui/Button';
import type { User } from '@supabase/supabase-js';
import type { InterviewHistoryItem } from '@/types/interview';
import type { AssessmentHistoryItem } from '@/types/assessment';

type Tab = 'interviews' | 'assessments';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('interviews');
  const [interviews, setInterviews] = useState<InterviewHistoryItem[]>([]);
  const [assessments, setAssessments] = useState<AssessmentHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const u = await getCurrentUser();
      if (!u) { router.push('/'); return; }
      setUser(u);

      const [iv, as] = await Promise.allSettled([
        getInterviewHistory(),
        getAssessmentHistory(),
      ]);

      if (iv.status === 'fulfilled') setInterviews(iv.value as InterviewHistoryItem[]);
      if (as.status === 'fulfilled') setAssessments(as.value as AssessmentHistoryItem[]);
      setIsLoading(false);
    }
    init();
  }, [router]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const totalSessions = interviews.length + assessments.length;
  const avgScore = [...interviews.map((i) => i.overall_score), ...assessments.map((a) => a.raw_score)]
    .filter(Boolean)
    .reduce((sum, s, _, arr) => sum + s / arr.length, 0);

  return (
    <>
      <Head>
        <title>Dashboard — Ascend</title>
        <meta name="description" content="Your personalized AI interview dashboard with history and performance trends." />
      </Head>

      <div className="page-container">
        {/* Navigation */}
        <nav className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-surface-border">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center">
              <span className="text-white font-black text-sm">A</span>
            </div>
            <span className="text-xl font-bold gradient-text">Ascend</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-text-muted hidden sm:block">
              {user?.email}
            </span>
            <Button variant="secondary" size="sm" onClick={handleSignOut}>Sign Out</Button>
          </div>
        </nav>

        <main className="max-w-5xl mx-auto px-6 md:px-12 py-10">
          {/* Welcome header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10"
          >
            <h1 className="text-3xl font-black text-text-primary">
              Welcome back 👋
            </h1>
            <p className="text-text-secondary mt-1">
              {user?.user_metadata?.full_name
                ? `Great to see you, ${(user.user_metadata.full_name as string).split(' ')[0]}!`
                : 'Your AI career preparation hub.'}
            </p>
          </motion.div>

          {/* Stats cards */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10"
          >
            {[
              { label: 'Total Sessions', value: totalSessions, icon: '🎯' },
              { label: 'Avg Score', value: totalSessions > 0 ? `${Math.round(avgScore)}%` : '—', icon: '📊' },
              { label: 'Interviews', value: interviews.length, icon: '🎤' },
              { label: 'Assessments', value: assessments.length, icon: '📝' },
            ].map((stat) => (
              <div key={stat.label} className="glass-card p-5">
                <div className="text-2xl mb-2">{stat.icon}</div>
                <div className="text-2xl font-black text-text-primary">{stat.value}</div>
                <div className="text-xs text-text-muted mt-0.5">{stat.label}</div>
              </div>
            ))}
          </motion.div>

          {/* Quick action CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid sm:grid-cols-2 gap-4 mb-10"
          >
            <Link href="/interview"
              className="gradient-border p-6 flex items-center gap-4 hover:scale-[1.02] transition-transform cursor-pointer group">
              <div className="w-12 h-12 rounded-xl bg-brand-500/15 flex items-center justify-center group-hover:bg-brand-500/25 transition-colors">
                <svg className="w-6 h-6 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.31a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-text-primary">Start AI Interview</p>
                <p className="text-sm text-text-muted">Live mock interview with voice AI</p>
              </div>
            </Link>

            <Link href="/assessment"
              className="glass-card p-6 flex items-center gap-4 hover:scale-[1.02] transition-transform cursor-pointer group glass-card-hover">
              <div className="w-12 h-12 rounded-xl bg-accent-500/15 flex items-center justify-center group-hover:bg-accent-500/25 transition-colors">
                <svg className="w-6 h-6 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-text-primary">Take MCQ Assessment</p>
                <p className="text-sm text-text-muted">AI-generated skill evaluation</p>
              </div>
            </Link>
          </motion.div>

          {/* History tabs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-1 mb-6 bg-surface-700/50 p-1 rounded-xl w-fit">
              {(['interviews', 'assessments'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize
                    ${activeTab === tab
                      ? 'bg-brand-500 text-white shadow-glow-cyan'
                      : 'text-text-muted hover:text-text-primary'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <HistoryTable
              items={activeTab === 'interviews' ? interviews : assessments}
              type={activeTab === 'interviews' ? 'interview' : 'assessment'}
              isLoading={isLoading}
            />
          </motion.div>
        </main>
      </div>
    </>
  );
}
