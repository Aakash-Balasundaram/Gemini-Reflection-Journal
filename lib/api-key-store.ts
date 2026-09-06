'use client';

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'user_gemini_api_key';

let listeners: Array<() => void> = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToApiKey(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  listeners = [...listeners, callback];
  window.addEventListener('storage', callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
    window.removeEventListener('storage', callback);
  };
}

export function getStoredApiKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function setStoredApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const clean = key.trim();
    if (clean) {
      localStorage.setItem(STORAGE_KEY, clean);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    emitChange();
  } catch {
    // Ignore storage quota or security errors in strict iframe environments
  }
}

export function removeStoredApiKey(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    emitChange();
  } catch {
    // Ignore
  }
}

export function hasCustomApiKey(): boolean {
  return Boolean(getStoredApiKey());
}

export function useApiKey(): string {
  return useSyncExternalStore(
    subscribeToApiKey,
    getStoredApiKey,
    () => ''
  );
}
