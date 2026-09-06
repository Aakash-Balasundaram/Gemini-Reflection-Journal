'use client';

import React from 'react';
import { useAuth } from './auth-context';
import {
  Sparkles,
  ShieldCheck,
  Database,
  Lock,
  MessageSquare,
  ArrowRight,
  AlertCircle,
  Lightbulb,
  FileText,
  KeyRound,
} from 'lucide-react';

export function LandingView() {
  const { signInWithGoogle, loading, error, clearError } = useAuth();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 sm:px-6 py-12 bg-[#0a0a0a] text-gray-200">
      <div className="w-full max-w-4xl mx-auto space-y-10">
        
        {/* Error Notification */}
        {error && (
          <div
            id="auth-error-banner"
            className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 flex items-start gap-3 text-sm shadow-xl"
          >
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-white">Authentication Notice</p>
              <p className="text-amber-200/80 text-xs mt-0.5">{error}</p>
            </div>
            <button
              onClick={clearError}
              className="text-xs text-amber-400 hover:text-amber-200 underline shrink-0 font-medium cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1a1a1a] border border-[#333333] text-xs font-mono text-gray-300 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Authenticated AI Journaling</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-serif tracking-tight text-white leading-tight">
            Reflect deeply. Converse with Gemini.
          </h1>

          <p className="text-gray-400 text-base sm:text-lg leading-relaxed">
            A private space for multi-turn journal reflections, creative brainstorming, and synthesized summaries. Authenticated securely via Google and persisted in your isolated Cloud Firestore.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              id="landing-signin-btn"
              onClick={signInWithGoogle}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/40 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.1 9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.5s.7 4.8 1.9 7.2l3.7-2.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.1-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
                    />
                  </svg>
                  <span>Sign in with Google</span>
                  <ArrowRight className="w-4 h-4 ml-1 text-white/80" />
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            No password required. Google Federated Authentication handles credentials securely.
          </p>
        </div>

        {/* Security & Architecture Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
          <div className="p-6 rounded-2xl border border-[#222222] bg-[#111111]/90 shadow-xl hover:border-[#333333] transition-colors space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-indigo-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-white text-sm">Owner-Bound Firestore</h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Every journal entry is saved under your private user document path{' '}
              <code className="px-1.5 py-0.5 rounded bg-black/60 border border-[#2a2a2a] font-mono text-[11px] text-indigo-300">
                /users/&#123;uid&#125;/interactions
              </code>
              . Security rules strictly enforce UID matching.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-[#222222] bg-[#111111]/90 shadow-xl hover:border-[#333333] transition-colors space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-white text-sm">Gemini 3.6 Flash Engine</h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Multi-turn conversational reflections with automated fallback resilience across model tiers (3.6 Flash, 3.1 Flash-Lite, 3.7 Flash) for high-availability synthesis.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-[#222222] bg-[#111111]/90 shadow-xl hover:border-[#333333] transition-colors space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-indigo-400 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-white text-sm">Server-Only Secret Guard</h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Gemini API keys are never bundled or exposed to the client browser. All AI prompts are executed through protected server route handlers.
            </p>
          </div>
        </div>

        {/* Feature Overview Strip */}
        <div className="border-t border-[#222222] pt-8">
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400 font-medium">
            <span className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              Multi-turn Dialogue
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              Structured Summaries
            </span>
            <span className="flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-indigo-400" />
              Actionable Brainstorming
            </span>
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              Real-time Firestore Sync
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
