'use client';

import React, { useState } from 'react';
import { Key, CheckCircle, AlertCircle, Sparkles, ExternalLink, X, Trash2, RefreshCw } from 'lucide-react';
import { useApiKey, setStoredApiKey, removeStoredApiKey } from '@/lib/api-key-store';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyUpdated?: (hasKey: boolean) => void;
}

function ApiKeyModalDialog({
  onClose,
  onKeyUpdated,
}: {
  onClose: () => void;
  onKeyUpdated?: (hasKey: boolean) => void;
}) {
  const currentKey = useApiKey();
  const [apiKey, setApiKey] = useState(currentKey);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const hasExistingKey = Boolean(currentKey);

  const handleTestKey = async (keyToTest: string) => {
    const key = keyToTest.trim();
    if (!key) {
      setTestResult({ success: false, message: 'Please enter a key to test.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/gemini/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        setTestResult({
          success: true,
          message: 'Key verified successfully! Connected to ' + (data.model || 'gemini-3.6-flash'),
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Key validation failed. Please check your key from Google AI Studio.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network test error';
      setTestResult({ success: false, message: msg });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const clean = apiKey.trim();
    if (clean) {
      setStoredApiKey(clean);
      onKeyUpdated?.(true);
    } else {
      removeStoredApiKey();
      onKeyUpdated?.(false);
    }
    onClose();
  };

  const handleRemove = () => {
    removeStoredApiKey();
    setApiKey('');
    setTestResult(null);
    onKeyUpdated?.(false);
  };

  return (
    <div
      id="api-key-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div
        id="api-key-modal-card"
        className="relative w-full max-w-lg bg-[#111111] border border-[#2a2a2a] rounded-2xl shadow-2xl p-6 text-gray-200 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#222222]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Gemini API Key Configuration</h2>
              <p className="text-xs text-gray-400">Configure your personal Google AI Studio key</p>
            </div>
          </div>
          <button
            id="close-api-key-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#222222] text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="py-5 space-y-4 text-xs">
          <p className="text-gray-300 leading-relaxed">
            By default, the application runs on high-performance Gemini models. You can connect your personal{' '}
            <strong className="text-white">Google AI Studio API Key</strong> to ensure uninterrupted live processing and quota independence.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="gemini-api-key-input" className="block font-medium text-gray-200">
              Gemini API Key
            </label>
            <div className="relative">
              <input
                id="gemini-api-key-input"
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder="AIzaSy..."
                className="w-full bg-[#181818] border border-[#333333] focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-500 outline-none font-mono transition-all"
              />
            </div>
          </div>

          {/* Key test status result */}
          {testResult && (
            <div
              id="test-key-result-banner"
              className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
                testResult.success
                  ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
                  : 'bg-red-950/30 border-red-800/40 text-red-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed">{testResult.message}</div>
            </div>
          )}

          {/* Helper Link */}
          <div className="pt-1 flex items-center justify-between text-[11px] text-gray-400">
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <span>Get a free key from Google AI Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            {hasExistingKey && (
              <button
                id="remove-api-key-btn"
                onClick={handleRemove}
                className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear Custom Key</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[#222222]">
          <button
            id="test-api-key-btn"
            onClick={() => handleTestKey(apiKey)}
            disabled={!apiKey.trim() || isTesting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1e1e1e] hover:bg-[#282828] text-gray-200 hover:text-white border border-[#333333] text-xs font-medium transition-colors cursor-pointer disabled:opacity-40"
          >
            {isTesting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                <span>Testing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Test Key</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              id="cancel-api-key-btn"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="save-api-key-btn"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              Save Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ApiKeyModal({ isOpen, onClose, onKeyUpdated }: ApiKeyModalProps) {
  if (!isOpen) return null;
  return <ApiKeyModalDialog onClose={onClose} onKeyUpdated={onKeyUpdated} />;
}
