'use client';

import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import type { InteractionDocument, ReflectionMode, TurnMessage, LocationData } from '@/lib/types';
import {
  Sparkles,
  Send,
  Save,
  Copy,
  Check,
  RotateCcw,
  BookOpen,
  FileText,
  Lightbulb,
  MessageSquare,
  AlertCircle,
  Clock,
  User as UserIcon,
  HelpCircle,
  Trash2,
  Key,
} from 'lucide-react';
import { ApiKeyModal } from './api-key-modal';
import { LocationTagger } from './location-tagger';
import { getStoredApiKey } from '@/lib/api-key-store';
import { useAuth } from './auth-context';

interface JournalCanvasProps {
  interaction: InteractionDocument;
  onUpdate: (updated: InteractionDocument) => Promise<void>;
  userId: string;
  isSaving: boolean;
}

function generateTurnId(role: 'user' | 'model'): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `turn-${crypto.randomUUID()}-${role}`;
  }
  return `turn-${Math.random().toString(36).slice(2, 11)}-${role}`;
}

const PROMPT_SUGGESTIONS = [
  'What decision or conversation challenged my assumptions today?',
  'Synthesize my key accomplishments this week and areas to sharpen.',
  'Brainstorm 3 pragmatic approaches to solve an ongoing bottleneck.',
  'Reflect on an unexpected emotion I felt during a recent collaboration.',
];

export function JournalCanvas({
  interaction,
  onUpdate,
  userId,
  isSaving,
}: JournalCanvasProps) {
  const { getIdToken } = useAuth();
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string>('Just now');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedPayload, setLastFailedPayload] = useState<{
    text: string;
    mode: ReflectionMode;
  } | null>(null);

  const turnsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    turnsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interaction.turns, isGenerating]);

  // Handle Location Change
  const handleLocationChange = async (newLocation: LocationData | undefined) => {
    const updated: InteractionDocument = {
      ...interaction,
      location: newLocation,
      updatedAt: new Date().toISOString(),
    };
    try {
      await onUpdate(updated);
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Failed to update location in Firestore:', err);
    }
  };

  // Handle Mode Change
  const handleModeChange = async (mode: ReflectionMode) => {
    const updated: InteractionDocument = {
      ...interaction,
      mode,
    };
    try {
      await onUpdate(updated);
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Failed to update mode in Firestore:', err);
    }
  };

  // Handle Title Change
  const handleTitleChange = async (newTitle: string) => {
    const updated: InteractionDocument = {
      ...interaction,
      title: newTitle,
    };
    try {
      await onUpdate(updated);
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Failed to update title in Firestore:', err);
    }
  };

  // Submit Reflection / Turn
  const handleSubmitTurn = async (
    forcedText?: string,
    forcedMode?: ReflectionMode,
    existingBaseTurns?: TurnMessage[]
  ) => {
    const textToSubmit = forcedText || inputText;
    const modeToUse = forcedMode || interaction.mode;

    if (!textToSubmit.trim() || isGenerating) return;

    setErrorMessage(null);
    setIsGenerating(true);

    // Clean prior history: strip out any placeholder/failed error turns before sending to Gemini
    const baseTurns = existingBaseTurns || interaction.turns;
    const cleanHistory = baseTurns.filter(
      (t) => t.content && t.content !== 'No response generated.'
    );

    const userTurn: TurnMessage = {
      id: generateTurnId('user'),
      role: 'user',
      content: textToSubmit.trim(),
      timestamp: new Date().toISOString(),
    };

    const newTurns = [...cleanHistory, userTurn];

    // Determine smart title if still default
    let newTitle = interaction.title;
    if (interaction.title === 'New Reflection' || !interaction.title.trim()) {
      newTitle =
        textToSubmit.trim().length > 40
          ? textToSubmit.trim().slice(0, 40) + '...'
          : textToSubmit.trim();
    }

    try {
      // 1. Call server-side Gemini route with resilient model fallback ladder
      const clientApiKey = getStoredApiKey();
      const res = await fetch('/api/gemini/reflect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(clientApiKey ? { 'x-gemini-api-key': clientApiKey } : {}),
        },
        body: JSON.stringify({
          messages: newTurns
            .filter((t) => t.content && t.content !== 'No response generated.')
            .map((t) => ({ role: t.role, content: t.content })),
          mode: modeToUse,
          prompt: textToSubmit.trim(),
        }),
      });

      const rawText = await res.text();
      let responseJson: Record<string, unknown> | null = null;
      try {
        if (rawText && rawText.trim().startsWith('{')) {
          responseJson = JSON.parse(rawText);
        }
      } catch {
        // Response was not JSON (e.g. HTML error page or plain text)
      }

      let modelText: string | null = null;
      if (responseJson) {
        if (typeof responseJson.response === 'string' && responseJson.response.trim().length > 0) {
          modelText = responseJson.response.trim();
        } else if (typeof responseJson.text === 'string' && responseJson.text.trim().length > 0) {
          modelText = responseJson.text.trim();
        } else if (typeof responseJson.output === 'string' && responseJson.output.trim().length > 0) {
          modelText = responseJson.output.trim();
        } else if (typeof responseJson.content === 'string' && responseJson.content.trim().length > 0) {
          modelText = responseJson.content.trim();
        }
      }

      if (!res.ok || !modelText) {
        const errorMsg =
          (responseJson && typeof responseJson.error === 'string' && responseJson.error)
            ? responseJson.error
            : !modelText
            ? 'Gemini was unable to generate a response. Please check your API key in Settings or retry.'
            : `HTTP ${res.status}: Failed to generate reflection`;

        setErrorMessage(errorMsg);
        setLastFailedPayload({ text: textToSubmit, mode: modeToUse });
        setIsGenerating(false);
        return;
      }

      const modelTurn: TurnMessage = {
        id: generateTurnId('model'),
        role: 'model',
        content: modelText,
        timestamp: new Date().toISOString(),
        model: typeof responseJson?.modelUsed === 'string' ? String(responseJson.modelUsed) : 'gemini-3.8-flash',
      };

      const finalTurns = [...newTurns, modelTurn];

      // 2. Persist to Firestore with guaranteed transaction verification
      const updatedDoc: InteractionDocument = {
        ...interaction,
        title: newTitle,
        turns: finalTurns,
        updatedAt: new Date().toISOString(),
      };

      await onUpdate(updatedDoc);
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

      // 3. Optional background notification dispatch (Directive 3) if user has opted into channels
      try {
        const idToken = await getIdToken();
        if (idToken) {
          fetch('/api/notifications/dispatch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              entryId: updatedDoc.id,
              triggerReason: modeToUse === 'summary' ? 'flagged_summary' : 'reflection_turn',
              summary: modelText.slice(0, 280),
            }),
          }).catch((e) => console.warn('Background notification dispatch skipped/silenced:', e));
        }
      } catch (e) {
        // Non-blocking notification dispatch
      }

      // Clear input only upon verified completion
      setInputText('');
      setLastFailedPayload(null);
    } catch (err: unknown) {
      console.warn('Reflection handled error:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error during reflection or saving.';
      setErrorMessage(msg);
      // Retain failed payload for retry banner
      setLastFailedPayload({ text: textToSubmit, mode: modeToUse });
    } finally {
      setIsGenerating(false);
    }
  };

  // Regenerate or process a turn using Gemini
  const handleRegenerateTurn = async (turnIndex: number) => {
    let promptToSubmit = '';
    // Look backwards for the user prompt
    for (let i = turnIndex - 1; i >= 0; i--) {
      if (interaction.turns[i]?.role === 'user' && interaction.turns[i]?.content) {
        promptToSubmit = interaction.turns[i].content;
        break;
      }
    }
    if (!promptToSubmit && interaction.turns[turnIndex]?.content) {
      promptToSubmit = interaction.turns[turnIndex].content;
    }
    if (!promptToSubmit) return;

    // Filter out the failed turn and preceding user turn so handleSubmitTurn adds it cleanly
    const turnsWithoutFailed = interaction.turns.filter((_, idx) => idx !== turnIndex);
    const baseTurns = turnsWithoutFailed.filter(
      (t) => !(t.role === 'user' && t.content === promptToSubmit)
    );

    await handleSubmitTurn(promptToSubmit, interaction.mode, baseTurns);
  };

  // Delete a specific turn from Firestore
  const handleDeleteTurn = async (turnId: string) => {
    const updatedTurns = interaction.turns.filter((t) => t.id !== turnId);
    const updatedDoc: InteractionDocument = {
      ...interaction,
      turns: updatedTurns,
      updatedAt: new Date().toISOString(),
    };
    await onUpdate(updatedDoc);
  };

  // Clear all failed placeholder turns in the session
  const handleClearFailedTurns = async () => {
    const cleaned = interaction.turns.filter(
      (t) => t.content && t.content !== 'No response generated.'
    );
    const updatedDoc: InteractionDocument = {
      ...interaction,
      turns: cleaned,
      updatedAt: new Date().toISOString(),
    };
    await onUpdate(updatedDoc);
  };

  // Auto-resolve any failed placeholder turns
  const handleAutoResolveAllFailedTurns = async () => {
    const failedIndex = interaction.turns.findIndex(
      (t) => t.content === 'No response generated.'
    );
    if (failedIndex !== -1) {
      await handleRegenerateTurn(failedIndex);
    }
  };

  // Quick Summarize All Turns
  const handleQuickSummarize = async () => {
    if (interaction.turns.length === 0) return;
    await handleSubmitTurn('Please generate a concise executive summary and key takeaways of our reflections so far.', 'summary');
  };

  // Copy turn content
  const handleCopy = async (turnId: string, text: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedTurnId(turnId);
      setTimeout(() => setCopiedTurnId(null), 2000);
    } catch (err) {
      console.warn('Clipboard write fallback: ', err);
      // Still visual indicate attempt completed
      setCopiedTurnId(turnId);
      setTimeout(() => setCopiedTurnId(null), 2000);
    }
  };

  return (
    <>
    <main
      id="active-journal-panel"
      className="flex-1 h-full flex flex-col bg-[#0a0a0a] overflow-hidden text-gray-200"
    >
      {/* Top Header / Canvas Meta */}
      <div className="border-b border-[#222222] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 bg-[#0d0d0d]/80 backdrop-blur-md">
        <div className="flex-1 min-w-[200px]">
          <input
            id="entry-title-input"
            type="text"
            value={interaction.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Reflection Title..."
            className="w-full text-base sm:text-lg font-serif font-semibold text-white bg-transparent border-none focus:outline-hidden hover:bg-[#161616] rounded px-1 -ml-1 transition-colors"
          />
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-0.5">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-gray-500" />
              Saved in Firestore ({lastSavedTime})
            </span>
            <span>•</span>
            <span className="px-1.5 py-0.2 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 font-mono text-[10px]">
              {interaction.turns.length} {interaction.turns.length === 1 ? 'turn' : 'turns'}
            </span>
            <span>•</span>
            <LocationTagger
              currentLocation={interaction.location}
              onLocationChange={handleLocationChange}
              disabled={isSaving}
            />
          </div>
        </div>

        {/* Mode Selector & Quick Actions */}
        <div className="flex items-center gap-2">
          <div id="mode-selector" className="flex items-center bg-[#141414] p-1 rounded-xl border border-[#262626] text-xs">
            <button
              onClick={() => handleModeChange('reflection')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                interaction.mode === 'reflection'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a1a]'
              }`}
              title="Deep Inquiry & Perspective"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reflect</span>
            </button>
            <button
              onClick={() => handleModeChange('summary')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                interaction.mode === 'summary'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a1a]'
              }`}
              title="Structured Synthesis & Takeaways"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Summary</span>
            </button>
            <button
              onClick={() => handleModeChange('brainstorm')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                interaction.mode === 'brainstorm'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a1a]'
              }`}
              title="Creative Ideas & Action Angles"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ideas</span>
            </button>
            <button
              onClick={() => handleModeChange('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                interaction.mode === 'chat'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a1a]'
              }`}
              title="Multi-turn Dialogue"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dialogue</span>
            </button>
          </div>

          {interaction.turns.length > 1 && (
            <button
              id="quick-summarize-btn"
              onClick={handleQuickSummarize}
              disabled={isGenerating}
              className="hidden md:flex items-center gap-1.5 text-xs font-medium text-gray-300 bg-[#161616] hover:bg-[#222222] border border-[#2e2e2e] px-3 py-1.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              title="Ask Gemini to synthesize current session"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Summarize</span>
            </button>
          )}

          <button
            id="manual-save-btn"
            onClick={async () => {
              await onUpdate(interaction);
              setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            }}
            disabled={isSaving}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-300 bg-[#161616] hover:bg-[#222222] border border-[#2e2e2e] px-3 py-1.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Force Synchronize with Cloud Firestore"
          >
            <Save className="w-3.5 h-3.5 text-gray-400" />
            <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Sync'}</span>
          </button>
        </div>
      </div>

      {/* Guaranteed Transaction Verification / Error Recovery Banner */}
      {errorMessage && (
        <div
          id="retry-save-banner"
          className="mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-start sm:items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              <strong>Persistence/Generation Error:</strong> {errorMessage}{' '}
              <span className="text-gray-400 font-normal">(Your input was safely retained)</span>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              id="open-key-settings-from-error-btn"
              onClick={() => setIsKeyModalOpen(true)}
              className="flex items-center gap-1.5 bg-[#1f1f1f] hover:bg-[#2a2a2a] text-gray-200 hover:text-white border border-[#3a3a3a] px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors shadow-sm"
            >
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              <span>Configure Key</span>
            </button>
            {lastFailedPayload && (
              <button
                id="retry-turn-btn"
                onClick={() => handleSubmitTurn(lastFailedPayload.text, lastFailedPayload.mode)}
                disabled={isGenerating}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors shadow-sm disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Helper banner for unanswered placeholder turns */}
      {interaction.turns.some((t) => t.content === 'No response generated.') && (
        <div
          id="unanswered-turns-banner"
          className="mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>You have an unanswered question from an earlier connection issue.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="auto-resolve-failed-btn"
              onClick={handleAutoResolveAllFailedTurns}
              disabled={isGenerating}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
            >
              <Sparkles className="w-3 h-3" />
              <span>Auto-Generate Answer</span>
            </button>
            <button
              id="configure-key-from-banner-btn"
              onClick={() => setIsKeyModalOpen(true)}
              className="px-2.5 py-1 bg-[#1c1c1c] hover:bg-[#282828] border border-[#333333] text-gray-300 hover:text-white rounded-lg text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1"
            >
              <Key className="w-3 h-3 text-indigo-400" />
              <span>Key Settings</span>
            </button>
            <button
              id="clear-failed-turns-btn"
              onClick={handleClearFailedTurns}
              className="px-2.5 py-1 bg-amber-900/60 hover:bg-amber-800 text-amber-200 hover:text-white rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Conversation / Reflection Turns Stream */}
      <div
        id="turns-container"
        className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6 bg-[#0a0a0a]"
      >
        {interaction.turns.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#161616] border border-[#2a2a2a] flex items-center justify-center text-indigo-400 shadow-lg">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-white font-serif">
                Begin Your Journal Reflection
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Write whatever is on your mind. Gemini 3.6 Flash will provide thoughtful reflections, structured takeaways, or ideas while saving every turn to your isolated Firestore account.
              </p>
            </div>

            {/* Prompt Starters */}
            <div className="w-full pt-4 space-y-2 text-left">
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block text-center">
                Inspiration Prompts
              </span>
              <div className="grid grid-cols-1 gap-2">
                {PROMPT_SUGGESTIONS.map((promptText, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInputText(promptText);
                    }}
                    className="w-full text-xs text-gray-300 bg-[#121212] hover:bg-[#181818] border border-[#262626] hover:border-[#383838] rounded-xl p-3 transition-all text-left flex items-start gap-2.5 group cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                    <span>{promptText}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          interaction.turns.map((turn, turnIndex) => {
            const isUser = turn.role === 'user';
            const isFailedPlaceholder = turn.content === 'No response generated.';
            return (
              <div
                key={turn.id}
                id={`turn-${turn.id}`}
                className={`flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {/* AI Avatar on left */}
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/30 mt-1">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                {/* Turn Bubble */}
                <div
                  className={`max-w-[85%] sm:max-w-[78%] p-4 sm:p-5 text-sm leading-relaxed transition-all ${
                    isUser
                      ? 'bg-[#1a1a1a] border border-[#333333] rounded-2xl rounded-tr-none shadow-xl text-gray-200'
                      : isFailedPlaceholder
                      ? 'bg-amber-950/20 border border-amber-800/40 rounded-2xl rounded-tl-none shadow-xl text-gray-300'
                      : 'bg-gradient-to-b from-[#111111] to-[#0a0a0a] border border-indigo-500/30 rounded-2xl rounded-tl-none shadow-2xl text-gray-300'
                  }`}
                >
                  {/* Model/User Info & Actions */}
                  <div className={`flex items-center justify-between gap-3 mb-2 pb-1.5 border-b text-[11px] ${isUser ? 'border-[#2a2a2a]' : isFailedPlaceholder ? 'border-amber-800/30' : 'border-indigo-500/20'}`}>
                    <span className={`font-mono font-medium ${isUser ? 'text-indigo-400' : isFailedPlaceholder ? 'text-amber-400 font-semibold' : 'text-indigo-400 uppercase tracking-wider font-semibold'}`}>
                      {isUser ? 'Your Journal Entry' : isFailedPlaceholder ? 'Pending Gemini Answer' : (turn.model ? turn.model.replace(/^models\//, '') : 'Gemini AI')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-500 mr-1">
                        {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {!isUser && !isFailedPlaceholder && (
                        <>
                          <button
                            id={`copy-btn-${turn.id}`}
                            onClick={() => handleCopy(turn.id, turn.content)}
                            className="p-1 hover:bg-indigo-950/40 rounded text-gray-400 hover:text-white transition-colors cursor-pointer"
                            title="Copy text"
                          >
                            {copiedTurnId === turn.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            id={`regen-btn-${turn.id}`}
                            onClick={() => handleRegenerateTurn(turnIndex)}
                            disabled={isGenerating}
                            className="p-1 hover:bg-indigo-950/40 rounded text-gray-400 hover:text-indigo-300 transition-colors cursor-pointer disabled:opacity-50"
                            title="Regenerate response with Gemini"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        </>
                      )}
                      <button
                        id={`delete-btn-${turn.id}`}
                        onClick={() => handleDeleteTurn(turn.id)}
                        className="p-1 hover:bg-red-950/30 rounded text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete turn"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Body Text */}
                  {isUser ? (
                    <p className="whitespace-pre-wrap font-sans text-gray-200">{turn.content}</p>
                  ) : isFailedPlaceholder ? (
                    <div className="py-2.5 px-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-200/90 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 my-1">
                      <div className="flex items-start sm:items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                        <div>
                          <p className="font-medium text-amber-300">
                            No response was generated for this turn due to an earlier connection issue.
                          </p>
                          <p className="text-[11px] text-amber-400/80">
                            Click below to process this question with Gemini.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <button
                          id={`process-gemini-btn-${turn.id}`}
                          onClick={() => handleRegenerateTurn(turnIndex)}
                          disabled={isGenerating}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Process with Gemini</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="markdown-body prose prose-invert max-w-none text-gray-300 prose-p:leading-relaxed prose-headings:text-white prose-headings:font-serif prose-headings:font-semibold prose-strong:text-white prose-ul:text-gray-300 prose-li:text-gray-300 prose-code:text-indigo-300">
                      <Markdown>{turn.content}</Markdown>
                    </div>
                  )}
                </div>

                {/* User Avatar on right */}
                {isUser && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0 mt-1 text-xs font-semibold shadow-md">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* AI Generating Indicator */}
        {isGenerating && (
          <div className="flex gap-3 sm:gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/30 animate-pulse mt-1">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-xl bg-[#121212] border border-indigo-500/30 text-xs text-gray-300 flex items-center gap-3 shadow-lg">
              <div className="w-4 h-4 border-2 border-[#333333] border-t-indigo-400 rounded-full animate-spin" />
              <span>Gemini 3.6 Flash is synthesizing insights and reflections...</span>
            </div>
          </div>
        )}

        <div ref={turnsEndRef} />
      </div>

      {/* Interactive Input Section */}
      <div id="input-section" className="border-t border-[#222222] p-4 sm:p-6 bg-gradient-to-t from-[#0a0a0a] to-[#0d0d0d]/90">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmitTurn();
          }}
          className="space-y-3 max-w-5xl mx-auto"
        >
          <div className="relative rounded-2xl border border-[#333333] bg-[#121212] focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/50 shadow-2xl transition-all">
            <textarea
              id="journal-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmitTurn();
                }
              }}
              placeholder={`Write your reflection or question in ${interaction.mode} mode... (Press Cmd+Enter to send)`}
              rows={3}
              className="w-full resize-none p-4 text-sm text-gray-200 placeholder:text-gray-600 bg-transparent border-none focus:outline-hidden leading-relaxed"
            />

            <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#1e1e1e] bg-[#0e0e0e]/70 text-xs">
              <div className="flex items-center gap-2 text-gray-500">
                <span>{inputText.length} chars</span>
                <span>•</span>
                <span className="hidden sm:inline">Cmd+Enter to reflect</span>
              </div>

              <button
                id="send-reflection-btn"
                type="submit"
                disabled={!inputText.trim() || isGenerating}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Reflecting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-white" />
                    <span>Send to Gemini</span>
                  </>
                )}
              </button>
            </div>
          </div>
          <p className="text-center text-[10px] text-gray-600 tracking-wide uppercase">
            Encrypted End-to-End • Firebase Cloud Security Protocols Active
          </p>
        </form>
      </div>
    </main>

    <ApiKeyModal
      isOpen={isKeyModalOpen}
      onClose={() => setIsKeyModalOpen(false)}
    />
    </>
  );
}
