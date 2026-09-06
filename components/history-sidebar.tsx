'use client';

import React, { useState } from 'react';
import type { InteractionDocument, ReflectionMode } from '@/lib/types';
import {
  Plus,
  Search,
  BookOpen,
  FileText,
  Lightbulb,
  MessageSquare,
  Trash2,
  Clock,
  ChevronRight,
  Filter,
  MapPin,
} from 'lucide-react';

interface HistorySidebarProps {
  interactions: InteractionDocument[];
  currentId: string | null;
  onSelect: (interaction: InteractionDocument) => void;
  onNew: () => void;
  onDelete: (id: string) => Promise<void>;
  loading: boolean;
}

export function HistorySidebar({
  interactions,
  currentId,
  onSelect,
  onNew,
  onDelete,
  loading,
}: HistorySidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredInteractions = interactions.filter((item) => {
    // Mode filter
    if (selectedFilter !== 'all' && item.mode !== selectedFilter) {
      return false;
    }

    // Search query filter
    if (!searchQuery.trim()) return true;
    const queryLower = searchQuery.toLowerCase();
    const titleMatch = item.title?.toLowerCase().includes(queryLower);
    const summaryMatch = item.summary?.toLowerCase().includes(queryLower);
    const turnMatch = item.turns?.some((t) => t.content?.toLowerCase().includes(queryLower));
    return titleMatch || summaryMatch || turnMatch;
  });

  const getModeIcon = (mode: ReflectionMode) => {
    switch (mode) {
      case 'summary':
        return <FileText className="w-3.5 h-3.5 text-blue-400" />;
      case 'brainstorm':
        return <Lightbulb className="w-3.5 h-3.5 text-amber-400" />;
      case 'chat':
        return <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />;
      case 'reflection':
      default:
        return <BookOpen className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      }).format(date);
    } catch {
      return 'Recently';
    }
  };

  return (
    <aside
      id="history-panel"
      className="w-full lg:w-80 h-full flex flex-col border-r border-[#222222] bg-[#111111] lg:fixed lg:left-0 lg:top-16 lg:bottom-0 lg:z-20"
    >
      {/* Top Action Header */}
      <div className="p-4 border-b border-[#222222] space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white tracking-tight flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span>Past Reflections</span>
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#1a1a1a] border border-[#333333] text-gray-400 font-mono">
            {interactions.length}
          </span>
        </div>

        <button
          id="new-entry-btn"
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Reflection Session</span>
        </button>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            id="search-history-input"
            type="text"
            placeholder="Search entries & transcripts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8.5 pr-3 py-1.5 text-xs rounded-lg border border-[#333333] bg-[#161616] text-gray-200 placeholder:text-gray-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] scrollbar-none">
          {[
            { id: 'all', label: 'All' },
            { id: 'reflection', label: 'Reflect' },
            { id: 'summary', label: 'Summary' },
            { id: 'brainstorm', label: 'Ideas' },
            { id: 'chat', label: 'Chat' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedFilter(tab.id)}
              className={`px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition-colors cursor-pointer ${
                selectedFilter === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:text-gray-200 hover:bg-[#222222]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interactions List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="p-6 text-center text-xs text-gray-500 space-y-2">
            <div className="w-5 h-5 border-2 border-[#333333] border-t-indigo-500 rounded-full animate-spin mx-auto" />
            <p>Syncing Firestore records...</p>
          </div>
        ) : filteredInteractions.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-500 space-y-2">
            <BookOpen className="w-8 h-8 text-gray-700 mx-auto" />
            <p className="font-medium text-gray-300">No reflections found</p>
            <p className="text-gray-500">
              {searchQuery ? 'Try adjusting your search query or filter.' : 'Write your first reflection to persist to Firestore.'}
            </p>
          </div>
        ) : (
          filteredInteractions.map((item) => {
            const isSelected = item.id === currentId;
            const turnCount = item.turns?.length || 0;
            const previewText =
              item.turns && item.turns.length > 0
                ? item.turns[item.turns.length - 1].content
                : 'No turns recorded yet';

            return (
              <div
                key={item.id}
                id={`history-item-${item.id}`}
                onClick={() => onSelect(item)}
                className={`group relative p-3 text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-950/30 border-l-2 border-indigo-500 border-y border-r border-[#262626] rounded-r-lg shadow-xs'
                    : 'bg-[#141414] hover:bg-[#1a1a1a] border border-[#222222] hover:border-[#333333] rounded-lg'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0">{getModeIcon(item.mode)}</span>
                    <h3 className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-gray-200 group-hover:text-white'}`}>
                      {item.title || 'Untitled Reflection'}
                    </h3>
                  </div>

                  {/* Delete Action with inline confirm (no window.confirm to avoid iframe sandbox errors) */}
                  {confirmDeleteId === item.id ? (
                    <div
                      className="flex items-center gap-1 shrink-0 z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        id={`confirm-delete-btn-${item.id}`}
                        onClick={async (e) => {
                          e.stopPropagation();
                          setDeletingId(item.id);
                          try {
                            await onDelete(item.id);
                          } finally {
                            setDeletingId(null);
                            setConfirmDeleteId(null);
                          }
                        }}
                        disabled={deletingId === item.id}
                        className="px-2 py-0.5 text-[10px] bg-red-600 hover:bg-red-500 text-white rounded font-medium transition-colors cursor-pointer"
                        title="Confirm permanent deletion"
                      >
                        {deletingId === item.id ? 'Deleting...' : 'Delete'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(null);
                        }}
                        className="px-1.5 py-0.5 text-[10px] bg-[#222222] hover:bg-[#333333] text-gray-300 rounded font-medium transition-colors cursor-pointer"
                        title="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      id={`delete-entry-btn-${item.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(item.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-500 hover:text-red-400 rounded hover:bg-[#222222] shrink-0 cursor-pointer"
                      title="Delete Entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-gray-500 group-hover:text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                  {previewText}
                </p>

                <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500">
                  <div className="flex items-center gap-2 truncate mr-1">
                    <span className="flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3 text-gray-600" />
                      {formatDate(item.updatedAt || item.createdAt)}
                    </span>
                    {item.location && (
                      <span
                        className="flex items-center gap-0.5 text-emerald-400/90 font-mono truncate max-w-[90px]"
                        title={item.location.formattedAddress}
                      >
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{item.location.formattedAddress.split(',')[0]}</span>
                      </span>
                    )}
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-[#1c1c1c] text-gray-400 border border-[#2a2a2a] font-mono shrink-0">
                    {turnCount} {turnCount === 1 ? 'turn' : 'turns'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
