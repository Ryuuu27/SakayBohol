import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useMapsLibrary} from '@vis.gl/react-google-maps';
import {LocateFixed, MapPin, Search, X} from 'lucide-react';
import {BOHOL_HUB_QUERIES} from '../data/boholTransitData';
import {LiveUserLocation} from '../hooks/useGeolocation';
import {ResolvedGooglePlace} from '../types/transit';

const BOHOL_BOUNDS = {
  south: 9.48,
  west: 123.68,
  north: 10.25,
  east: 124.65,
};

function notifyIfQuotaError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('QuotaExceededError') ||
    msg.includes('429')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

interface PlaceSearchInputProps {
  label: string;
  badgeLetter: 'A' | 'B';
  selectedPlace: ResolvedGooglePlace | null;
  onSelectPlace: (place: ResolvedGooglePlace) => void;
  resolvedHubs: Record<string, ResolvedGooglePlace>;
  isOnline: boolean;
  hasMapsApiKey?: boolean;
  userLocation: LiveUserLocation | null;
  onRequestLiveGps?: () => void;
}

export const PlaceSearchInput: React.FC<PlaceSearchInputProps> = ({
  label,
  badgeLetter,
  selectedPlace,
  onSelectPlace,
  resolvedHubs,
  isOnline,
  hasMapsApiKey = true,
  userLocation,
  onRequestLiveGps,
}) => {
  const placesLib = useMapsLibrary('places');
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (!placesLib || !isOnline || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      const {AutocompleteSessionToken, AutocompleteSuggestion} = placesLib;
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new AutocompleteSessionToken();
      }

      setIsSearching(true);
      AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query.trim(),
        locationRestriction: BOHOL_BOUNDS,
        region: 'ph',
        sessionToken: sessionTokenRef.current,
      })
        .then((res) => {
          setSuggestions(res?.suggestions ?? []);
        })
        .catch((err) => {
          notifyIfQuotaError(err);
          setSuggestions([]);
        })
        .finally(() => {
          setIsSearching(false);
        });
    }, 220);

    return () => clearTimeout(timer);
  }, [placesLib, isOnline, query]);

  const handleSelectPrediction = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!placesLib || !suggestion.placePrediction) return;
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['id', 'displayName', 'formattedAddress', 'location', 'rating'],
        });
        const loc = place.location;
        if (!loc) return;
        const resolved: ResolvedGooglePlace = {
          placeId: place.id || `gmp_${Date.now()}`,
          displayName:
            place.displayName ||
            suggestion.placePrediction.text?.text ||
            'Selected Bohol Location',
          formattedAddress: place.formattedAddress || 'Bohol, Philippines',
          lat: loc.lat(),
          lng: loc.lng(),
          rating: place.rating ?? null,
          cachedAt: Date.now(),
        };
        sessionTokenRef.current = null;
        setSuggestions([]);
        setQuery('');
        setIsOpen(false);
        onSelectPlace(resolved);
      } catch (err) {
        notifyIfQuotaError(err);
      }
    },
    [placesLib, onSelectPlace]
  );

  const handleUseCurrentGps = () => {
    if (userLocation) {
      onSelectPlace({
        placeId: 'live_gps_origin',
        displayName: 'My Live GPS Position',
        formattedAddress: `${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)} (±${userLocation.accuracyMeters}m)`,
        lat: userLocation.lat,
        lng: userLocation.lng,
        cachedAt: Date.now(),
      });
      setQuery('');
      setIsOpen(false);
    } else if (onRequestLiveGps) {
      onRequestLiveGps();
      setIsOpen(false);
    }
  };

  const filteredHubs = BOHOL_HUB_QUERIES.map((cfg) => ({
    cfg,
    place: resolvedHubs[cfg.hubKey],
  })).filter(({cfg, place}) => {
    if (!place) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      cfg.label.toLowerCase().includes(q) ||
      place.displayName.toLowerCase().includes(q) ||
      cfg.zone.toLowerCase().includes(q)
    );
  });

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}
      </label>
      <div className="relative flex items-center">
        <span
          className={`pointer-events-none absolute left-3 flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold font-mono ${
            badgeLetter === 'A'
              ? 'bg-teal-700 text-white'
              : 'bg-slate-900 text-white'
          }`}
        >
          {badgeLetter}
        </span>
        <input
          type="text"
          value={isOpen ? query : selectedPlace?.displayName ?? query}
          onFocus={() => {
            setIsOpen(true);
            setQuery('');
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          placeholder="Search Bohol beach, terminal, or town..."
          className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white pl-11 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20 transition-colors"
        />
        {isOpen && query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-1 flex min-h-[40px] min-w-[40px] items-center justify-center text-slate-400 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <Search className="pointer-events-none absolute right-3.5 h-4 w-4 text-slate-400" />
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          {badgeLetter === 'A' && (
            <button
              type="button"
              onClick={handleUseCurrentGps}
              className="flex w-full min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-teal-800 hover:bg-teal-50/70 transition-colors"
            >
              <LocateFixed className="h-4 w-4 shrink-0 text-teal-700" />
              <div className="min-w-0 flex-1">
                <div className="truncate">
                  {userLocation
                    ? 'Use My Live GPS Location'
                    : 'Enable Live GPS for Current Position'}
                </div>
                {userLocation && (
                  <div className="text-xs font-mono text-slate-500 truncate">
                    {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)} · ±
                    {userLocation.accuracyMeters}m
                  </div>
                )}
              </div>
            </button>
          )}

          {suggestions.length > 0 && (
            <div className="mt-1 border-t border-slate-100 pt-1">
              <div className="px-3 py-1 text-xs font-medium text-slate-500">
                Live Search Results
              </div>
              {suggestions.map((s, idx) => {
                const text = s.placePrediction?.text?.text || 'Bohol Place';
                return (
                  <button
                    key={`${text}-${idx}`}
                    type="button"
                    onClick={() => void handleSelectPrediction(s)}
                    className="flex w-full min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="text-sm text-slate-800 truncate">{text}</span>
                  </button>
                );
              })}
              <div className="px-3 py-1 text-[11px] text-slate-400">
                Google Maps
              </div>
            </div>
          )}

          {isSearching && (
            <div className="px-3 py-2 text-xs text-slate-500">
              Searching Bohol places...
            </div>
          )}

          {filteredHubs.length > 0 && (
            <div className="mt-1 border-t border-slate-100 pt-1">
              <div className="px-3 py-1 text-xs font-medium text-slate-500">
                Popular Bohol Transit Hubs & Stops
              </div>
              {filteredHubs.map(({cfg, place}) => (
                <button
                  key={cfg.hubKey}
                  type="button"
                  onClick={() => {
                    onSelectPlace(place);
                    setQuery('');
                    setIsOpen(false);
                  }}
                  className="flex w-full min-h-[48px] items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {place.displayName}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {cfg.zone} · {place.formattedAddress}
                    </div>
                  </div>
                </button>
              ))}
              <div className="px-3 py-1 text-[11px] text-slate-400">
                Google Maps
              </div>
            </div>
          )}

          {filteredHubs.length === 0 && suggestions.length === 0 && !isSearching && (
            <div className="px-3 py-3 text-xs text-slate-500 leading-relaxed">
              {!hasMapsApiKey
                ? 'Configure VITE_GOOGLE_MAPS_API_KEY in your hosting environment variables to search live Bohol places, or use Schedules & Fares.'
                : isOnline
                  ? 'Type at least 2 characters to search any Bohol address, resort, or terminal.'
                  : 'Offline mode active — connect briefly to resolve new Bohol places.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
