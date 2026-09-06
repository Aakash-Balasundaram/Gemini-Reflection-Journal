'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  type User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  role: 'admin' | 'moderator' | 'user';
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  clearError: () => void;
  refreshClaims: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'moderator' | 'user'>('user');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserRole = async (currentUser: User | null) => {
    if (!currentUser) {
      setRole('user');
      return;
    }
    const isBootstrappedAdmin = currentUser.email?.toLowerCase() === 'aakash735cse@gmail.com';
    if (isBootstrappedAdmin) {
      setRole('admin');
      return;
    }
    try {
      const tokenResult = await currentUser.getIdTokenResult();
      const roleClaim = (tokenResult.claims.role as string) || 'user';
      if (roleClaim === 'admin' || roleClaim === 'moderator' || roleClaim === 'user') {
        setRole(roleClaim);
      } else {
        setRole('user');
      }
    } catch (e) {
      console.warn('Failed to retrieve token claims:', e);
      setRole('user');
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        setUser(currentUser);
        await fetchUserRole(currentUser);
        setLoading(false);
      },
      (authErr) => {
        console.error('Firebase Auth state error:', authErr);
        setError(authErr.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const refreshClaims = async () => {
    if (!auth.currentUser) return;
    try {
      // Force token refresh to fetch latest custom claims from Firebase Auth
      await auth.currentUser.getIdToken(true);
      await fetchUserRole(auth.currentUser);
    } catch (err) {
      console.warn('Error refreshing custom claims:', err);
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken();
    } catch (err) {
      console.error('Error getting ID token:', err);
      return null;
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      console.error('Google Sign-In Error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to sign in with Google.';
      if (msg.includes('popup-closed-by-user')) {
        setError('Sign-in cancelled: The authentication popup window was closed before finishing.');
      } else if (msg.includes('popup-blocked')) {
        setError('Popup was blocked by your browser. Please allow popups or open this applet in a new tab.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const signOutUser = async () => {
    setError(null);
    try {
      await signOut(auth);
      setUser(null);
    } catch (err: unknown) {
      console.error('Sign Out Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign out.');
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        error,
        signInWithGoogle,
        signOutUser,
        clearError,
        refreshClaims,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
