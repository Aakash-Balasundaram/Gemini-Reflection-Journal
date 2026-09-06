'use client';

import React from 'react';
import { AuthProvider, useAuth } from '@/components/auth-context';
import { Navbar } from '@/components/navbar';
import { LandingView } from '@/components/landing-view';
import { Dashboard } from '@/components/dashboard';

function AppContent() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-gray-200 selection:bg-indigo-900 selection:text-white">
      <Navbar />

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
          <div className="w-8 h-8 border-3 border-[#222222] border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-xs text-gray-500 font-mono">Initializing authentication state...</p>
        </div>
      ) : user ? (
        <Dashboard />
      ) : (
        <LandingView />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
