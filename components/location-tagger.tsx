'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, X, Check, Loader2, Search, Navigation } from 'lucide-react';
import type { LocationData } from '@/lib/types';
import { useAuth } from './auth-context';

interface LocationTaggerProps {
  currentLocation?: LocationData;
  onLocationChange: (loc: LocationData | undefined) => void;
  disabled?: boolean;
}

const SAMPLE_PLACES = [
  { name: 'San Francisco, CA, USA', placeId: 'ChIJIQBpAG2ahYAR_6128GcTUEo', lat: 37.7749, lng: -122.4194 },
  { name: 'Tokyo, Japan', placeId: 'ChIJ513GhQKfGGAROxcrABtNNxI', lat: 35.6762, lng: 139.6503 },
  { name: 'London, UK', placeId: 'ChIJdd4hrwug2EcRmSrV3Vo6llI', lat: 51.5074, lng: -0.1278 },
  { name: 'New York, NY, USA', placeId: 'ChIJOwg_06VPwokRYv534QaPC8g', lat: 40.7128, lng: -74.006 },
];

export function LocationTagger({
  currentLocation,
  onLocationChange,
  disabled = false,
}: LocationTaggerProps) {
  const { getIdToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [sessionToken, setSessionToken] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleOpenPopover = () => {
    const token = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`;
    setSessionToken(token);
    setErrorMsg(null);
    setIsOpen(true);
  };

  // Resolve a selected place_id via backend server-side Places API
  const handleSelectPlace = async (placeId: string, suggestedName?: string, lat?: number, lng?: number) => {
    setIsResolving(true);
    setErrorMsg(null);

    try {
      const idToken = await getIdToken();
      if (!idToken) {
        throw new Error('You must be signed in to resolve location data.');
      }

      // STRICT MANDATE: Send placeId to server, never free-text coordinates directly to Firestore
      const res = await fetch('/api/locations/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          placeId,
          sessionToken,
          suggestedName,
          lat,
          lng,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.location) {
        throw new Error(data.error || 'Failed to resolve location via server');
      }

      // Canonical server-resolved location object with source: 'google_places'
      onLocationChange(data.location);
      setIsOpen(false);
      setQuery('');
    } catch (err: unknown) {
      console.error('Failed to resolve location:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error resolving location');
    } finally {
      setIsResolving(false);
    }
  };

  const filteredSamples = SAMPLE_PLACES.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative inline-block text-left">
      {/* Current Location Badge or Attach Button */}
      {currentLocation ? (
        <div className="flex items-center gap-1.5 bg-[#161616] border border-[#2a2a2a] text-gray-300 text-xs px-2.5 py-1 rounded-lg">
          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate max-w-[140px] sm:max-w-[200px]" title={currentLocation.formattedAddress}>
            {currentLocation.formattedAddress}
          </span>
          <span className="text-[10px] text-emerald-400/90 font-mono bg-emerald-950/60 px-1 rounded border border-emerald-800/40">
            Verified
          </span>
          {!disabled && (
            <button
              onClick={() => onLocationChange(undefined)}
              className="text-gray-500 hover:text-red-400 ml-1 cursor-pointer"
              title="Remove location tag"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleOpenPopover}
          disabled={disabled}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 bg-[#161616] hover:bg-[#202020] border border-[#2a2a2a] px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          title="Tag entry with verified Google Places location"
        >
          <MapPin className="w-3.5 h-3.5 text-indigo-400" />
          <span>Add Location</span>
        </button>
      )}

      {/* Autocomplete & Resolution Popover */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-[#121212] border border-[#2c2c2c] rounded-xl shadow-2xl z-40 p-3 text-gray-200">
          <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
            <div className="flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs font-semibold text-white">Google Places Location</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>

          <p className="text-[11px] text-gray-400 mt-2 mb-2 leading-relaxed">
            Select a location. Coordinates are verified server-side via Google Place Details prior to saving.
          </p>

          {/* Search Input */}
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search city or landmark..."
              className="w-full bg-[#181818] border border-[#333333] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {errorMsg && (
            <div className="mb-2 p-2 bg-red-950/60 border border-red-800 text-red-300 text-[11px] rounded-lg">
              {errorMsg}
            </div>
          )}

          {/* Places List */}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {filteredSamples.map((place) => (
              <button
                key={place.placeId}
                disabled={isResolving}
                onClick={() => handleSelectPlace(place.placeId, place.name, place.lat, place.lng)}
                className="w-full text-left p-2 rounded-lg hover:bg-[#1f1f1f] text-xs flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2 truncate">
                  <MapPin className="w-3 h-3 text-indigo-400 group-hover:text-white shrink-0" />
                  <span className="truncate">{place.name}</span>
                </div>
                {isResolving ? (
                  <Loader2 className="w-3 h-3 animate-spin text-indigo-400 shrink-0" />
                ) : (
                  <span className="text-[10px] text-gray-500 font-mono">Select</span>
                )}
              </button>
            ))}

            {query.trim().length > 0 && !filteredSamples.some((p) => p.name.toLowerCase() === query.toLowerCase()) && (
              <button
                disabled={isResolving}
                onClick={() => handleSelectPlace(`custom-${Date.now()}`, query.trim())}
                className="w-full text-left p-2 rounded-lg bg-indigo-950/30 hover:bg-indigo-900/40 border border-indigo-700/30 text-xs flex items-center justify-between transition-colors cursor-pointer mt-1 text-indigo-200"
              >
                <div className="flex items-center gap-2 truncate">
                  <Search className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="truncate">Resolve: &quot;{query}&quot;</span>
                </div>
                {isResolving ? (
                  <Loader2 className="w-3 h-3 animate-spin text-indigo-400 shrink-0" />
                ) : (
                  <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-mono">Resolve</span>
                )}
              </button>
            )}
          </div>

          <div className="mt-2 pt-2 border-t border-[#222222] flex items-center justify-between text-[10px] text-gray-500">
            <span>Source: google_places</span>
            <span>Session Token Active</span>
          </div>
        </div>
      )}
    </div>
  );
}
