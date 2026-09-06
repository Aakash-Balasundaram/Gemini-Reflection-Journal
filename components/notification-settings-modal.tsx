'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  ShieldCheck,
  Hash,
} from 'lucide-react';
import { useAuth } from './auth-context';
import {
  saveNotificationPreferences,
  getNotificationPreferences,
  saveNotificationLog,
  subscribeToNotificationLogs,
} from '@/lib/firestore-service';
import type { NotificationSettings, NotificationLogItem } from '@/lib/types';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationSettingsModal({
  isOpen,
  onClose,
}: NotificationSettingsModalProps) {
  const { user, getIdToken } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: false,
    channels: {
      slack: false,
      discord: false,
      email: false,
    },
  });
  const [logs, setLogs] = useState<NotificationLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load preferences and delivery history
  const loadPreferences = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setFeedback(null);
    try {
      const prefs = await getNotificationPreferences(user.uid);
      setSettings(prefs);
    } catch (err: unknown) {
      console.warn('Error loading preferences from Firestore:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Real-time listener for notification logs
  useEffect(() => {
    let active = true;
    if (!isOpen || !user) return;

    const execute = async () => {
      await Promise.resolve();
      if (!active) return;
      await loadPreferences();
    };
    execute();

    const unsubscribe = subscribeToNotificationLogs(user.uid, (fetchedLogs) => {
      if (!active) return;
      setLogs(
        fetchedLogs.map((l) => ({
          id: l.id || '',
          channel: l.channel,
          triggerReason: l.triggerReason,
          deliveredAt: l.deliveredAt,
          status: l.status,
          entryId: l.entryId,
        }))
      );
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [isOpen, user, loadPreferences]);

  // Save updated preferences
  const handleSaveSettings = async (newSettings: NotificationSettings) => {
    if (!user) return;
    setSaving(true);
    setFeedback(null);
    try {
      await saveNotificationPreferences(user.uid, newSettings);
      setSettings(newSettings);
      setFeedback({
        type: 'success',
        message: 'Notification preferences saved successfully.',
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error saving settings',
      });
    } finally {
      setSaving(false);
    }
  };

  // Dispatch a test alert
  const handleTestDispatch = async (channel: 'slack' | 'discord' | 'email') => {
    if (!user) return;
    setTesting(true);
    setFeedback(null);
    try {
      const idToken = await getIdToken();
      const res = await fetch('/api/notifications/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          isTest: true,
          channel,
          triggerReason: 'test_dispatch',
          summary: 'Manual test validation of outbound webhook alerting pipeline.',
          preferences: settings,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Dispatch test failed');

      // Mirror log entries in Firestore via user-authenticated client
      if (data.logEntries && Array.isArray(data.logEntries)) {
        for (const entry of data.logEntries) {
          await saveNotificationLog(user.uid, entry).catch((e) =>
            console.warn('Could not mirror log entry to Firestore:', e)
          );
        }
      }

      setFeedback({
        type: 'success',
        message: `Test dispatch to ${channel.toUpperCase()} completed: ${
          data.results?.[channel]?.status || 'Dispatched'
        }`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error dispatching test notification',
      });
    } finally {
      setTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#111111] rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-[#2a2a2a] overflow-hidden text-gray-200">
        {/* Header */}
        <div className="p-5 border-b border-[#222222] flex items-center justify-between bg-[#141414]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-700/50 flex items-center justify-center">
              <Bell className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm sm:text-base">
                Notification &amp; Webhook Settings
              </h3>
              <p className="text-xs text-gray-400">
                Opt-in external alerts (Slack, Discord, Email). Cooldown enforced at 300s.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#222222] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Banners */}
        {feedback && (
          <div
            className={`px-4 py-2 text-xs flex items-center gap-2 border-b ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                : 'bg-red-950/60 border-red-800 text-red-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Privacy & Trust Badge */}
          <div className="p-3.5 bg-indigo-950/30 rounded-xl border border-indigo-700/30 text-indigo-200 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Privacy Guarantee: Zero Verbatim Journal Leakage</p>
              <p className="text-[11px] text-indigo-300/90 mt-0.5 leading-relaxed">
                Outbound webhooks strictly transmit an anonymous SHA-256 hash of your UID and a short Gemini-synthesized summary. Raw journal text is never sent to third-party endpoints.
              </p>
            </div>
          </div>

          {/* Master Opt-In Toggle */}
          <div className="flex items-center justify-between p-4 bg-[#161616] border border-[#262626] rounded-xl">
            <div>
              <span className="font-medium text-white text-sm">Enable External Notifications</span>
              <p className="text-gray-400 text-xs mt-0.5">
                Default is strictly disabled. Toggle on to authorize alerts.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => {
                  const updated = { ...settings, enabled: e.target.checked };
                  setSettings(updated);
                  handleSaveSettings(updated);
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#2a2a2a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Channel Selectors */}
          <div className="space-y-3">
            <h4 className="font-semibold text-white text-xs uppercase tracking-wider text-gray-400">
              Notification Channels
            </h4>

            {/* Slack */}
            <div className="p-3.5 bg-[#161616] border border-[#262626] rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#222222] flex items-center justify-center font-bold text-gray-300">
                  #
                </div>
                <div>
                  <p className="font-medium text-white">Slack Incoming Webhook</p>
                  <p className="text-[11px] text-gray-400 font-mono">
                    Secret: SLACK_WEBHOOK_URL (Server-side)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleTestDispatch('slack')}
                  disabled={testing}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 bg-[#1e1e1e] border border-[#333333] px-2.5 py-1 rounded-lg cursor-pointer"
                >
                  Test
                </button>
                <input
                  type="checkbox"
                  disabled={!settings.enabled}
                  checked={settings.channels.slack}
                  onChange={(e) => {
                    const updated = {
                      ...settings,
                      channels: { ...settings.channels, slack: e.target.checked },
                    };
                    setSettings(updated);
                    handleSaveSettings(updated);
                  }}
                  className="rounded border-[#333333] bg-[#222222] text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer disabled:opacity-50"
                />
              </div>
            </div>

            {/* Discord */}
            <div className="p-3.5 bg-[#161616] border border-[#262626] rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#222222] flex items-center justify-center font-bold text-indigo-400">
                  D
                </div>
                <div>
                  <p className="font-medium text-white">Discord Webhook</p>
                  <p className="text-[11px] text-gray-400 font-mono">
                    Secret: DISCORD_WEBHOOK_URL (Server-side)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleTestDispatch('discord')}
                  disabled={testing}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 bg-[#1e1e1e] border border-[#333333] px-2.5 py-1 rounded-lg cursor-pointer"
                >
                  Test
                </button>
                <input
                  type="checkbox"
                  disabled={!settings.enabled}
                  checked={settings.channels.discord}
                  onChange={(e) => {
                    const updated = {
                      ...settings,
                      channels: { ...settings.channels, discord: e.target.checked },
                    };
                    setSettings(updated);
                    handleSaveSettings(updated);
                  }}
                  className="rounded border-[#333333] bg-[#222222] text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer disabled:opacity-50"
                />
              </div>
            </div>

            {/* Email */}
            <div className="p-3.5 bg-[#161616] border border-[#262626] rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#222222] flex items-center justify-center font-bold text-emerald-400">
                  @
                </div>
                <div>
                  <p className="font-medium text-white">Email Service Alert</p>
                  <p className="text-[11px] text-gray-400 font-mono">
                    Secret: EMAIL_API_KEY (Server-side)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleTestDispatch('email')}
                  disabled={testing}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 bg-[#1e1e1e] border border-[#333333] px-2.5 py-1 rounded-lg cursor-pointer"
                >
                  Test
                </button>
                <input
                  type="checkbox"
                  disabled={!settings.enabled}
                  checked={settings.channels.email}
                  onChange={(e) => {
                    const updated = {
                      ...settings,
                      channels: { ...settings.channels, email: e.target.checked },
                    };
                    setSettings(updated);
                    handleSaveSettings(updated);
                  }}
                  className="rounded border-[#333333] bg-[#222222] text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Delivery History */}
          <div className="space-y-2">
            <h4 className="font-semibold text-white text-xs uppercase tracking-wider text-gray-400">
              Recent Delivery Logs (Per-User)
            </h4>
            {loading ? (
              <div className="text-gray-500 text-center py-4">Loading delivery logs...</div>
            ) : logs.length === 0 ? (
              <div className="p-3 bg-[#161616] border border-[#262626] rounded-xl text-gray-500 text-center text-xs">
                No notification delivery events recorded yet.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 bg-[#161616] border border-[#262626] rounded-lg flex items-center justify-between text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono uppercase text-indigo-400">{log.channel}</span>
                      <span className="text-gray-400">[{log.triggerReason}]</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-mono">{log.status}</span>
                      <span className="text-gray-500 font-mono">
                        {new Date(log.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#222222] bg-[#141414] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#202020] hover:bg-[#2a2a2a] text-white rounded-xl text-xs font-medium transition-colors cursor-pointer border border-[#333333]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
