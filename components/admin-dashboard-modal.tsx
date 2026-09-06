'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  ScrollText,
  Key,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
} from 'lucide-react';
import { useAuth } from './auth-context';
import type { AdminAuditLogItem } from '@/lib/types';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserItem {
  uid: string;
  email?: string;
  displayName?: string;
  role: 'admin' | 'moderator' | 'user';
  createdAt?: string;
  lastSignInTime?: string;
}

export function AdminDashboardModal({ isOpen, onClose }: AdminDashboardModalProps) {
  const { user, role, refreshClaims, getIdToken } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'security'>('users');
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  const isAdmin = role === 'admin';

  // Load users
  const loadUsers = React.useCallback(async () => {
    if (!user) return;
    setLoadingUsers(true);
    setActionError(null);
    try {
      const idToken = await getIdToken();
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch users');
      setUsersList(data.users || []);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error fetching users');
    } finally {
      setLoadingUsers(false);
    }
  }, [user, getIdToken]);

  // Load audit logs
  const loadAuditLogs = React.useCallback(async () => {
    if (!user) return;
    setLoadingLogs(true);
    setActionError(null);
    try {
      const idToken = await getIdToken();
      const res = await fetch('/api/admin/audit-logs', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch audit logs');
      setAuditLogs(data.logs || []);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error fetching audit logs');
    } finally {
      setLoadingLogs(false);
    }
  }, [user, getIdToken]);

  useEffect(() => {
    let active = true;
    if (isOpen && isAdmin) {
      // Async deferred execution prevents synchronous setState in effect mount
      const execute = async () => {
        await Promise.resolve();
        if (!active) return;
        if (activeTab === 'users') {
          await loadUsers();
        } else if (activeTab === 'audit') {
          await loadAuditLogs();
        }
      };
      execute();
    }
    return () => {
      active = false;
    };
  }, [isOpen, isAdmin, activeTab, loadUsers, loadAuditLogs]);

  // Handle changing user role via Admin SDK custom claims
  const handleChangeRole = async (targetUid: string, newRole: 'admin' | 'moderator' | 'user') => {
    setUpdatingUid(targetUid);
    setActionError(null);
    setActionSuccess(null);

    try {
      const idToken = await getIdToken();
      const res = await fetch('/api/admin/set-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ targetUid, role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change role');

      setActionSuccess(`Successfully updated role to ${newRole} for user ${targetUid.slice(0, 8)}...`);
      // Refresh local claims and users list
      await refreshClaims();
      await loadUsers();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error changing role');
    } finally {
      setUpdatingUid(null);
    }
  };

  // Bootstrap initial admin role for testing & dev environment
  const handleBootstrapAdmin = async () => {
    setBootstrapping(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const idToken = await getIdToken();
      const res = await fetch('/api/admin/bootstrap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bootstrap failed');

      setActionSuccess('Admin custom claim granted! Refreshing your token credentials...');
      await refreshClaims();
      await loadUsers();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Bootstrap error');
    } finally {
      setBootstrapping(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#111111] rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-[#2a2a2a] overflow-hidden text-gray-200">
        {/* Header */}
        <div className="p-5 border-b border-[#222222] flex items-center justify-between bg-[#141414]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-700/50 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white text-sm sm:text-base">
                  Admin Dashboard &amp; RBAC Control
                </h3>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                    isAdmin
                      ? 'bg-indigo-950/80 border border-indigo-600/50 text-indigo-300'
                      : 'bg-amber-950/80 border border-amber-600/50 text-amber-300'
                  }`}
                >
                  {isAdmin ? 'ADMIN VERIFIED' : 'UNPRIVILEGED'}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Server-side custom claims enforcement &amp; immutable audit logging
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
        {actionError && (
          <div className="bg-red-950/60 border-b border-red-800 text-red-300 px-4 py-2 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}
        {actionSuccess && (
          <div className="bg-emerald-950/60 border-b border-emerald-800 text-emerald-300 px-4 py-2 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-[#222222] bg-[#121212] px-4 gap-2">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'users'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>User Management ({usersList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" />
            <span>Immutable Audit Logs</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'security'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Directives &amp; Security Specs</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs">
          {!isAdmin ? (
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-950/60 border border-amber-600/40 text-amber-400 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-white font-semibold text-sm">Server-Side RBAC Restriction Active</h4>
                <p className="text-gray-400 max-w-md mx-auto mt-1 leading-relaxed">
                  Your current account does not have the Firebase Custom Claim <code className="font-mono text-indigo-400">role: &quot;admin&quot;</code>. All administrative endpoints enforce server-side validation.
                </p>
              </div>
              <button
                onClick={handleBootstrapAdmin}
                disabled={bootstrapping}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium shadow-lg shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {bootstrapping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                <span>Bootstrap Initial Admin Role for This Session</span>
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'users' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
                    <span className="text-gray-400 text-xs">
                      Server-side role management. Roles are written exclusively via Firebase Admin SDK.
                    </span>
                    <button
                      onClick={loadUsers}
                      disabled={loadingUsers}
                      className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white bg-[#1a1a1a] border border-[#333333] px-2.5 py-1 rounded-lg cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingUsers ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {loadingUsers ? (
                    <div className="py-8 text-center text-gray-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                      Loading users from Firebase Auth...
                    </div>
                  ) : (
                    <div className="border border-[#262626] rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#161616] text-gray-400 border-b border-[#262626]">
                          <tr>
                            <th className="py-2.5 px-3">User</th>
                            <th className="py-2.5 px-3">UID</th>
                            <th className="py-2.5 px-3">Current Role</th>
                            <th className="py-2.5 px-3 text-right">Assign Role</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#222222]">
                          {usersList.map((u) => {
                            const isCurrentUser = u.uid === user?.uid;
                            return (
                              <tr key={u.uid} className="hover:bg-[#161616]/50 transition-colors">
                                <td className="py-2.5 px-3 font-medium text-white">
                                  <div className="flex items-center gap-2">
                                    <span>{u.displayName || u.email || 'User'}</span>
                                    {isCurrentUser && (
                                      <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-700/50 px-1.5 py-0.5 rounded">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-gray-500">{u.email}</span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-gray-400 text-[11px]">
                                  {u.uid.slice(0, 10)}...
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                                      u.role === 'admin'
                                        ? 'bg-purple-950 text-purple-300 border border-purple-700/50'
                                        : u.role === 'moderator'
                                        ? 'bg-blue-950 text-blue-300 border border-blue-700/50'
                                        : 'bg-gray-800 text-gray-300 border border-gray-700'
                                    }`}
                                  >
                                    {u.role.toUpperCase()}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {['user', 'moderator', 'admin'].map((r) => (
                                      <button
                                        key={r}
                                        disabled={updatingUid === u.uid || u.role === r}
                                        onClick={() => handleChangeRole(u.uid, r as 'admin' | 'moderator' | 'user')}
                                        className={`px-2 py-1 rounded text-[10px] font-mono transition-colors cursor-pointer disabled:opacity-40 ${
                                          u.role === r
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-[#1e1e1e] hover:bg-[#282828] text-gray-300 border border-[#333333]'
                                        }`}
                                      >
                                        {r}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'audit' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
                    <span className="text-gray-400 text-xs">
                      Immutable administrative logs stored in <code className="font-mono text-indigo-300">/adminAuditLogs</code>. Write-only via server.
                    </span>
                    <button
                      onClick={loadAuditLogs}
                      disabled={loadingLogs}
                      className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white bg-[#1a1a1a] border border-[#333333] px-2.5 py-1 rounded-lg cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingLogs ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {loadingLogs ? (
                    <div className="py-8 text-center text-gray-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                      Loading immutable audit logs...
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <div className="py-8 text-center text-gray-500">No audit logs recorded yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-3 bg-[#161616] border border-[#262626] rounded-xl flex items-start justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-indigo-400 font-medium text-xs">{log.action}</span>
                              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-700/50 px-1.5 py-0.2 rounded font-mono">
                                {log.result}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400 font-mono">
                              Actor: {log.actorUid.slice(0, 10)}... → Target: {log.targetUid.slice(0, 10)}...
                            </p>
                          </div>
                          <span className="text-[11px] text-gray-500 font-mono">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-4 leading-relaxed">
                  <div className="p-4 bg-indigo-950/30 border border-indigo-700/40 rounded-xl space-y-2">
                    <h5 className="font-semibold text-white">Trust Boundary 1: Google Maps Geodata</h5>
                    <p className="text-gray-300">
                      Dual API keys active. Client sends strictly <code className="font-mono text-indigo-300">placeId</code> with session token. Server resolves coordinates using <code className="font-mono text-indigo-300">GOOGLE_MAPS_SERVER_KEY</code>. Firestore rule prohibits any client writes where <code className="font-mono text-indigo-300">source != &apos;google_places&apos;</code>.
                    </p>
                  </div>

                  <div className="p-4 bg-indigo-950/30 border border-indigo-700/40 rounded-xl space-y-2">
                    <h5 className="font-semibold text-white">Trust Boundary 2: RBAC Custom Claims</h5>
                    <p className="text-gray-300">
                      Roles live in cryptographic Firebase Custom Claims, never in client-writable Firestore documents. Every privileged endpoint verifies tokens server-side with <code className="font-mono text-indigo-300">adminAuth.verifyIdToken()</code>.
                    </p>
                  </div>

                  <div className="p-4 bg-indigo-950/30 border border-indigo-700/40 rounded-xl space-y-2">
                    <h5 className="font-semibold text-white">Trust Boundary 3: External Notifications</h5>
                    <p className="text-gray-300">
                      Slack/Discord webhook URLs and API keys reside exclusively in server Secret Manager. Cooldown is strictly enforced (300s). Payloads use versioned schema (v1.0) and send only short Gemini summaries, never raw journal text.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#222222] bg-[#141414] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#202020] hover:bg-[#2a2a2a] text-white rounded-xl text-xs font-medium transition-colors cursor-pointer border border-[#333333]"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
