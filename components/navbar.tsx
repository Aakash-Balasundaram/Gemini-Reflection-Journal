'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useAuth } from './auth-context';
import {
  ShieldCheck,
  ShieldAlert,
  Database,
  Sparkles,
  LogOut,
  LogIn,
  User as UserIcon,
  Key,
  Bell,
} from 'lucide-react';
import { ApiKeyModal } from './api-key-modal';
import { AdminDashboardModal } from './admin-dashboard-modal';
import { NotificationSettingsModal } from './notification-settings-modal';
import { useApiKey } from '@/lib/api-key-store';

export function Navbar() {
  const { user, role, signInWithGoogle, signOutUser, loading } = useAuth();
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const activeKey = useApiKey();
  const hasKey = Boolean(activeKey);
  const isAdmin = role === 'admin';

  return (
    <>
      <header className="w-full border-b border-[#222222] bg-[#0c0c0c]/90 backdrop-blur-md fixed top-0 left-0 right-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand & Indicators */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-white tracking-tight text-base sm:text-lg">
                  Reflections
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#1a1a1a] border border-[#333333] text-gray-300 font-mono font-medium">
                  Gemini 3.6
                </span>
              </div>
              <div className="hidden sm:flex items-center space-x-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Database className="w-3 h-3 text-indigo-400" />
                  Firestore Isolated
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-indigo-400" />
                  RBAC Active
                </span>
              </div>
            </div>
          </div>

          {/* Actions: Notifications + Admin + API Key Settings + User Auth */}
          <div className="flex items-center space-x-2 sm:space-x-2.5">
            {user && (
              <>
                {/* Notification Settings Toggle */}
                <button
                  id="open-notifications-nav-btn"
                  onClick={() => setIsNotificationModalOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-xl border bg-[#181818] border-[#333333] text-gray-300 hover:text-white hover:bg-[#222222] transition-colors cursor-pointer"
                  title="Configure Notification Webhooks (Slack/Discord/Email)"
                >
                  <Bell className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden lg:inline">Alerts</span>
                </button>

                {/* Admin Dashboard Toggle (UI Gated via Custom Claims) */}
                <button
                  id="open-admin-dashboard-nav-btn"
                  onClick={() => setIsAdminModalOpen(true)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                    isAdmin
                      ? 'bg-purple-950/50 border-purple-700/60 text-purple-300 hover:bg-purple-900/60 shadow-xs'
                      : 'bg-[#181818] border-[#333333] text-gray-300 hover:text-white hover:bg-[#222222]'
                  }`}
                  title={isAdmin ? 'Admin Dashboard (Verified)' : 'Admin Dashboard & RBAC'}
                >
                  <ShieldAlert className={`w-3.5 h-3.5 ${isAdmin ? 'text-purple-400' : 'text-indigo-400'}`} />
                  <span className="hidden md:inline">Admin</span>
                  {isAdmin && (
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0"></span>
                  )}
                </button>
              </>
            )}

            <button
              id="open-api-key-modal-nav-btn"
              onClick={() => setIsKeyModalOpen(true)}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                hasKey
                  ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/50'
                  : 'bg-[#181818] border-[#333333] text-gray-300 hover:text-white hover:bg-[#222222]'
              }`}
              title="Configure personal Gemini API Key"
            >
              <Key className={`w-3.5 h-3.5 ${hasKey ? 'text-emerald-400' : 'text-indigo-400'}`} />
              <span className="hidden lg:inline">{hasKey ? 'Gemini Active' : 'API Key'}</span>
            </button>

            {loading ? (
              <div className="text-xs text-gray-500 animate-pulse">Authenticating...</div>
            ) : user ? (
              <div className="flex items-center space-x-2 sm:space-x-2.5">
                <div className="flex items-center space-x-2 bg-[#161616] border border-[#2a2a2a] rounded-full py-1 pl-2 pr-3">
                  {user.photoURL ? (
                    <Image
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      width={24}
                      height={24}
                      className="w-6 h-6 rounded-full object-cover border border-[#333333]"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-semibold">
                      {user.displayName ? user.displayName.charAt(0).toUpperCase() : <UserIcon className="w-3 h-3" />}
                    </div>
                  )}
                  <span className="text-xs font-medium text-gray-200 max-w-[90px] sm:max-w-[160px] truncate">
                    {user.displayName || user.email}
                  </span>
                </div>
                <button
                  id="signout-btn"
                  onClick={signOutUser}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white bg-[#1a1a1a] hover:bg-[#222222] border border-[#333333] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  title="Sign Out of Session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                id="google-signin-btn"
                onClick={signInWithGoogle}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-medium px-4 py-2 rounded-xl shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-white" />
                <span>Sign in with Google</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
      />

      <AdminDashboardModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />

      <NotificationSettingsModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
      />
    </>
  );
}

