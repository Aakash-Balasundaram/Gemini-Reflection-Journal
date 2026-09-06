'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-context';
import { HistorySidebar } from './history-sidebar';
import { JournalCanvas } from './journal-canvas';
import {
  subscribeToUserInteractions,
  persistInteraction,
  removeInteraction,
} from '@/lib/firestore-service';
import type { InteractionDocument } from '@/lib/types';
import { BookOpen, Sparkles, Menu, X, CheckCircle2, ShieldCheck, Database, HelpCircle } from 'lucide-react';

export function Dashboard() {
  const { user } = useAuth();
  const [interactions, setInteractions] = useState<InteractionDocument[]>([]);
  const [currentInteraction, setCurrentInteraction] = useState<InteractionDocument | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Helper to create a new draft interaction
  const createFreshDraft = useCallback((uid: string): InteractionDocument => {
    return {
      id: 'doc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      userId: uid,
      title: 'New Reflection',
      mode: 'reflection',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      turns: [],
    };
  }, []);

  // Real-time Firestore subscription scoped strictly to the authenticated user UID
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToUserInteractions(
      user.uid,
      (fetched) => {
        setInteractions(fetched);
        setLoadingHistory(false);

        // If no active interaction yet or current was deleted, pick the first or create a draft
        setCurrentInteraction((prev) => {
          if (prev) {
            const updatedMatch = fetched.find((f) => f.id === prev.id);
            if (updatedMatch) return updatedMatch;
            // If current was deleted
            if (!fetched.some((f) => f.id === prev.id) && prev.turns.length > 0) {
              return fetched.length > 0 ? fetched[0] : createFreshDraft(user.uid);
            }
            return prev;
          }
          return fetched.length > 0 ? fetched[0] : createFreshDraft(user.uid);
        });
      },
      (err) => {
        console.error('Firestore subscription error:', err);
        setLoadingHistory(false);
      }
    );

    return () => unsubscribe();
  }, [user, createFreshDraft]);

  // Handle creating a new entry
  const handleNewEntry = () => {
    if (!user) return;
    const fresh = createFreshDraft(user.uid);
    setCurrentInteraction(fresh);
    setSidebarOpenMobile(false);
  };

  // Handle selecting an existing entry
  const handleSelectEntry = (entry: InteractionDocument) => {
    setCurrentInteraction(entry);
    setSidebarOpenMobile(false);
  };

  // Handle updating & persisting an interaction to Firestore
  const handleUpdateInteraction = async (updated: InteractionDocument) => {
    if (!user) return;
    setIsSaving(true);
    setCurrentInteraction(updated);
    try {
      await persistInteraction(user.uid, updated);
    } catch (err) {
      console.error('Failed to persist to Firestore:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  // Handle deleting an interaction
  const handleDeleteInteraction = async (id: string) => {
    if (!user) return;
    try {
      await removeInteraction(user.uid, id);
      if (currentInteraction?.id === id) {
        const remaining = interactions.filter((i) => i.id !== id);
        setCurrentInteraction(remaining.length > 0 ? remaining[0] : createFreshDraft(user.uid));
      }
    } catch (err) {
      console.error('Failed to delete interaction from Firestore:', err);
      setDashboardError('Could not delete reflection: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  if (!user) return null;

  const activeDoc = currentInteraction || createFreshDraft(user.uid);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-[#0a0a0a] text-gray-200">
      {/* Optional Dashboard Error Banner */}
      {dashboardError && (
        <div className="bg-red-950/80 border-b border-red-800 text-red-200 px-4 py-2 text-xs flex items-center justify-between">
          <span>{dashboardError}</span>
          <button
            onClick={() => setDashboardError(null)}
            className="text-red-400 hover:text-white font-medium ml-3 cursor-pointer"
          >
            ✕ Dismiss
          </button>
        </div>
      )}

      {/* Mobile Top Toggle Strip */}
      <div className="lg:hidden border-b border-[#222222] bg-[#111111] px-4 py-2 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpenMobile(!sidebarOpenMobile)}
          className="flex items-center gap-2 text-xs font-medium text-gray-300 bg-[#1a1a1a] border border-[#333333] px-3 py-1.5 rounded-lg"
        >
          {sidebarOpenMobile ? <X className="w-3.5 h-3.5" /> : <Menu className="w-3.5 h-3.5" />}
          <span>{sidebarOpenMobile ? 'Close Past Reflections' : 'View Past Reflections'}</span>
        </button>

        <span className="text-xs text-gray-400 font-mono truncate max-w-[150px]">
          {activeDoc.title}
        </span>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar for Desktop & Mobile Overlay */}
        <div
          className={`
            fixed inset-y-0 left-0 z-20 w-80 bg-[#111111] transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0
            ${sidebarOpenMobile ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <HistorySidebar
            interactions={interactions}
            currentId={activeDoc.id}
            onSelect={handleSelectEntry}
            onNew={handleNewEntry}
            onDelete={handleDeleteInteraction}
            loading={loadingHistory}
          />
        </div>

        {/* Mobile Backdrop */}
        {sidebarOpenMobile && (
          <div
            onClick={() => setSidebarOpenMobile(false)}
            className="fixed inset-0 bg-black/70 z-10 lg:hidden backdrop-blur-xs"
          />
        )}

        {/* Main Canvas Area */}
        <JournalCanvas
          interaction={activeDoc}
          onUpdate={handleUpdateInteraction}
          userId={user.uid}
          isSaving={isSaving}
        />
      </div>

      {/* Floating Verification / Walkthrough Quick Toggle */}
      <div className="fixed bottom-4 right-4 z-30">
        <button
          id="walkthrough-guide-btn"
          onClick={() => setShowTestModal(true)}
          className="flex items-center gap-2 bg-[#161616]/95 hover:bg-[#202020] text-gray-200 text-xs px-3.5 py-2 rounded-full shadow-2xl border border-[#333333] backdrop-blur-md transition-transform active:scale-95 cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
          <span>Security & Test Walkthrough</span>
        </button>
      </div>

      {/* Walkthrough & Test Case Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#111111] rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-[#2a2a2a] overflow-hidden text-gray-200">
            <div className="p-5 border-b border-[#222222] flex items-center justify-between bg-[#141414]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-white text-sm">
                  Functional Stability & Security Walkthrough
                </h3>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#222222] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-gray-300 leading-relaxed">
              <div className="p-3.5 bg-indigo-950/40 rounded-xl border border-indigo-500/30 text-indigo-200 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">User Isolation Active</p>
                  <p className="text-[11px] text-indigo-300/90 mt-0.5">
                    Logged in as UID: <code className="font-mono bg-black/50 px-1.5 py-0.5 rounded text-indigo-300 border border-indigo-500/20">{user.uid}</code>. Firestore path: <code className="font-mono bg-black/50 px-1.5 py-0.5 rounded text-indigo-300 border border-indigo-500/20">/users/{user.uid}/interactions/*</code>. Other users have zero read or write privileges.
                  </p>
                </div>
              </div>

              <h4 className="font-semibold text-white text-sm pt-2">Step-by-Step Test Procedure:</h4>

              <div className="space-y-3">
                <div className="p-3.5 bg-[#161616] rounded-xl border border-[#262626]">
                  <p className="font-medium text-white">Test Case 1: Multi-Turn Reflection Dialogue</p>
                  <p className="text-gray-400 mt-1">
                    1. Type a reflection into the textarea (or click an inspiration prompt).<br/>
                    2. Click &quot;Send to Gemini&quot; (or press Cmd+Enter).<br/>
                    3. Verify Gemini 3.6 Flash responds with empathetic analysis and follow-up inquiry.<br/>
                    4. Reply with a follow-up answer; observe multi-turn context continuity.
                  </p>
                </div>

                <div className="p-3.5 bg-[#161616] rounded-xl border border-[#262626]">
                  <p className="font-medium text-white">Test Case 2: Mode Switching (Summary &amp; Brainstorm)</p>
                  <p className="text-gray-400 mt-1">
                    1. Toggle mode pills to &quot;Summary&quot; or &quot;Ideas&quot; in the top bar.<br/>
                    2. Submit a request (or click &quot;Summarize&quot;).<br/>
                    3. Verify the output changes to structured markdown bullet points with action steps.
                  </p>
                </div>

                <div className="p-3.5 bg-[#161616] rounded-xl border border-[#262626]">
                  <p className="font-medium text-white">Test Case 3: Firestore Persistence &amp; Real-time History</p>
                  <p className="text-gray-400 mt-1">
                    1. Refresh the browser tab or open in another window.<br/>
                    2. Sign in with the same account.<br/>
                    3. Observe all previous turns, titles, and timestamps loaded in the left History sidebar.
                  </p>
                </div>

                <div className="p-3.5 bg-[#161616] rounded-xl border border-[#262626]">
                  <p className="font-medium text-white">Test Case 4: Search &amp; Delete Operations</p>
                  <p className="text-gray-400 mt-1">
                    1. Type a keyword into &quot;Search entries &amp; transcripts...&quot; in the sidebar.<br/>
                    2. Filter list responds instantly.<br/>
                    3. Hover an item and click the trash can icon; confirm deletion from Firestore.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#222222] bg-[#141414] flex justify-end">
              <button
                onClick={() => setShowTestModal(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                Close Walkthrough
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
