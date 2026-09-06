'use client';

import React from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-gray-200 p-6 text-center">
      <h1 className="text-3xl font-bold tracking-tight text-red-400 mb-2">Something went wrong</h1>
      <p className="text-sm text-gray-400 max-w-md mb-6">
        {error.message || 'An unexpected error occurred while loading this view.'}
      </p>
      <button
        onClick={() => reset()}
        className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors cursor-pointer"
      >
        Try Again
      </button>
    </div>
  );
}
