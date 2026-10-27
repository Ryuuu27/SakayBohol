import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  ArrowUpDown,
  BookmarkCheck,
  Compass,
  DownloadCloud,
  Layers,
  LocateFixed,
  Navigation,
  Users,
  WifiOff,
} from 'lucide-react';
import {BOHOL_HUB_QUERIES, calculateBoholFares} from '../data/boholTransitData';
import {computeHaversineMeters, LiveUserLocation} from '../hooks/useGeolocation';
import {
  FareModeEstimate,
  ResolvedGooglePlace,
  RouteStepSummary,
  SavedOfflineRoute,
} from '../types/transit';
import {
  saveCachedHubs,
  upsertSavedOfflineRoute,
} from '../utils/offlineStorage';
import {PlaceSearchInput} from './PlaceSearchInput';

// General camera center over Bohol Island before Google Places resolve
const BOHOL_ISLAND_CENTER = {lat: 9.83, lng: 124.14};

function checkAndDispatchQuotaError(err: unknown) {
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

function stripHtmlTags(raw: string): string {
  return raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

interface ActiveRouteRenderProps {
  origin: ResolvedGooglePlace | null;
  destination: ResolvedGooglePlace | null;
  isOnline: boolean;
  onRouteComputed: (route: SavedOfflineRoute) => void;
  onRouteError: (msg: string | null) => void;
  onLoadingChange: (loading: boolean) => void;
}

/**
 * Child component inside <Map> that resolves Bohol transit hubs via Place.searchByText
 * and computes/renders live route polylines via Route.computeRoutes.
 */
const MapServicesController: React.FC<
  ActiveRouteRenderProps & {
    resolvedHubs: Record<string, ResolvedGooglePlace>;
    onHubsUpdated: (hubs: Record<string, ResolvedGooglePlace>) => void;
    panToTarget: {lat: number; lng: number; seq: number} | null;
  }
> = ({
  origin,
  destination,
  isOnline,
  onRouteComputed,
  onRouteError,
  onLoadingChange,
  resolvedHubs,
  onHubsUpdated,
  panToTarget,
}) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const resolvingRef = useRef(false);

  // Pan map when user taps "Locate Me"
  useEffect(() => {
    if (map && panToTarget) {
      map.panTo({lat: panToTarget.lat, lng: panToTarget.lng});
      if ((map.getZoom() ?? 10) < 13) {
        map.setZoom(14);
      }
    }
  }, [map, panToTarget]);

  // Resolve Bohol hubs dynamically from Google Maps Places API (New)
  useEffect(() => {
    if (!placesLib || !isOnline || resolvingRef.current) return;
    const missing = BOHOL_HUB_QUERIES.filter((h) => !resolvedHubs[h.hubKey]);
    if (missing.length === 0) return;

    resolvingRef.current = true;
    let cancelled = false;

    const runResolve = async () => {
      const updated: Record<string, ResolvedGooglePlace> = {...resolvedHubs};
      let changed = false;

      for (const cfg of missing) {
        if (cancelled) break;
        try {
          const {places} = await placesLib.Place.searchByText({
            textQuery: cfg.searchQuery,
            fields: [
              'id',
              'displayName',
              'formattedAddress',
              'location',
              'rating',
            ],
            region: 'ph',
            maxResultCount: 1,
            internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
          });
          const top = places?.[0];
          if (top?.location) {
            updated[cfg.hubKey] = {
              placeId: top.id || cfg.hubKey,
              hubKey: cfg.hubKey,
              displayName: top.displayName || cfg.label,
              formattedAddress: top.formattedAddress || 'Bohol, Philippines',
              lat: top.location.lat(),
              lng: top.location.lng(),
              rating: top.rating ?? null,
              cachedAt: Date.now(),
            };
            changed = true;
          }
        } catch (err) {
          checkAndDispatchQuotaError(err);
        }
      }

      if (!cancelled && changed) {
        saveCachedHubs(updated);
        onHubsUpdated(updated);
      }
      resolvingRef.current = false;
    };

    void runResolve();
    return () => {
      cancelled = true;
      resolvingRef.current = false;
    };
  }, [placesLib, isOnline, resolvedHubs, onHubsUpdated]);

  // Compute and render live road route via Routes API (Route.computeRoutes)
  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!routesLib || !map || !origin || !destination || !isOnline) {
      return;
    }

    if (
      Math.abs(origin.lat - destination.lat) < 0.0001 &&
      Math.abs(origin.lng - destination.lng) < 0.0001
    ) {
      onRouteError('Select two different stops in Bohol to calculate a route.');
      return;
    }

    let cancelled = false;
    onLoadingChange(true);
    onRouteError(null);

    const request: google.maps.routes.ComputeRoutesRequest = {
      origin: {lat: origin.lat, lng: origin.lng},
      destination: {lat: destination.lat, lng: destination.lng},
      travelMode: 'DRIVING' as google.maps.TravelMode,
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs'],
      internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
    };

    routesLib.Route.computeRoutes(request)
      .then(({routes}) => {
        if (cancelled) return;
        onLoadingChange(false);

        const primary = routes?.[0];
        if (!primary) {
          onRouteError('No drivable land route found between these two points.');
          return;
        }

        const createdPolylines = primary.createPolylines();
        createdPolylines.forEach((poly) => {
          poly.setOptions({
            strokeColor: '#0f766e',
            strokeOpacity: 0.92,
            strokeWeight: 5,
          });
          poly.setMap(map);
        });
        polylinesRef.current = createdPolylines;

        if (primary.viewport) {
          map.fitBounds(primary.viewport, 48);
        }

        const leg = primary.legs?.[0];
        const steps: RouteStepSummary[] = (leg?.steps ?? [])
          .map((s) => ({
            instruction: s.instructions ? stripHtmlTags(s.instructions) : 'Continue along road',
            distanceMeters: s.distanceMeters ?? 0,
            maneuver: s.maneuver ?? null,
          }))
          .filter((s) => s.instruction.length > 0);

        const rawPath = primary.path ?? [];
        // Downsample path slightly for compact 30-day offline storage
        const stride = Math.max(1, Math.floor(rawPath.length / 80));
        const pathCoords = rawPath
          .filter((_, idx) => idx % stride === 0 || idx === rawPath.length - 1)
          .map((pt) => {
            const jsonPt = pt.toJSON() as {lat: number; lng: number};
            return {lat: jsonPt.lat, lng: jsonPt.lng};
          });

        const routeRecord: SavedOfflineRoute = {
          id: `${origin.placeId}__${destination.placeId}`,
          originName: origin.displayName,
          originAddress: origin.formattedAddress,
          originLat: origin.lat,
          originLng: origin.lng,
          destinationName: destination.displayName,
          destinationAddress: destination.formattedAddress,
          destinationLat: destination.lat,
          destinationLng: destination.lng,
          distanceMeters: primary.distanceMeters ?? 0,
          durationMillis: primary.durationMillis ?? 0,
          steps,
          pathCoords,
          cachedAt: Date.now(),
        };

        onRouteComputed(routeRecord);
      })
      .catch((err) => {
        if (cancelled) return;
        onLoadingChange(false);
        checkAndDispatchQuotaError(err);
        onRouteError(
          'Unable to calculate live route right now. Checking saved offline routes if available.'
        );
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [
    routesLib,
    map,
    origin,
    destination,
    isOnline,
    onRouteComputed,
    onRouteError,
    onLoadingChange,
  ]);

  return null;
};

interface BoholMapWorkspaceProps {
  resolvedHubs: Record<string, ResolvedGooglePlace>;
  onHubsUpdated: (hubs: Record<string, ResolvedGooglePlace>) => void;
  savedRoutes: SavedOfflineRoute[];
  onSavedRoutesChange: (routes: SavedOfflineRoute[]) => void;
  selectedOrigin: ResolvedGooglePlace | null;
  selectedDestination: ResolvedGooglePlace | null;
  onSelectOrigin: (p: ResolvedGooglePlace | null) => void;
  onSelectDestination: (p: ResolvedGooglePlace | null) => void;
  isOnline: boolean;
  isTrackingGps: boolean;
  userLocation: LiveUserLocation | null;
  geoError: string | null;
  onStartGps: () => void;
  onStopGps: () => void;
  selectedCurrency: string;
  formatConverted: (php: number) => string;
}

export const BoholMapWorkspace: React.FC<BoholMapWorkspaceProps> = ({
  resolvedHubs,
  onHubsUpdated,
  savedRoutes,
  onSavedRoutesChange,
  selectedOrigin,
  selectedDestination,
  onSelectOrigin,
  onSelectDestination,
  isOnline,
  isTrackingGps,
  userLocation,
  geoError,
  onStartGps,
  onStopGps,
  selectedCurrency,
  formatConverted,
}) => {
  const [activeRoute, setActiveRoute] = useState<SavedOfflineRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [passengers, setPassengers] = useState(2);
  const [hasDiscount, setHasDiscount] = useState(false);
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'terrain' | 'hybrid'>('roadmap');
  const [activeHubPopup, setActiveHubPopup] = useState<ResolvedGooglePlace | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [panToTarget, setPanToTarget] = useState<{
    lat: number;
    lng: number;
    seq: number;
  } | null>(null);
  const [justSavedToast, setJustSavedToast] = useState(false);

  // Auto-select default corridor (Dao Terminal -> Chocolate Hills or Alona Beach) once hubs resolve
  useEffect(() => {
    if (!selectedOrigin && resolvedHubs['dao_terminal']) {
      onSelectOrigin(resolvedHubs['dao_terminal']);
    }
    if (!selectedDestination && resolvedHubs['alona_beach']) {
      onSelectDestination(resolvedHubs['alona_beach']);
    }
  }, [resolvedHubs, selectedOrigin, selectedDestination, onSelectOrigin, onSelectDestination]);

  // Offline route lookup if network drops or live route fails
  useEffect(() => {
    if (!selectedOrigin || !selectedDestination) return;
    const matchId = `${selectedOrigin.placeId}__${selectedDestination.placeId}`;
    const cached = savedRoutes.find((r) => r.id === matchId);
    if (!isOnline && cached) {
      setActiveRoute(cached);
      setRouteError(null);
    } else if (!isOnline && !cached) {
      // Fallback approximate road distance (1.28x Haversine winding factor for Bohol roads)
      const straightMeters = computeHaversineMeters(
        {lat: selectedOrigin.lat, lng: selectedOrigin.lng},
        {lat: selectedDestination.lat, lng: selectedDestination.lng}
      );
      const approxRoadMeters = Math.round(straightMeters * 1.28);
      setActiveRoute({
        id: matchId,
        originName: selectedOrigin.displayName,
        originAddress: selectedOrigin.formattedAddress,
        originLat: selectedOrigin.lat,
        originLng: selectedOrigin.lng,
        destinationName: selectedDestination.displayName,
        destinationAddress: selectedDestination.formattedAddress,
        destinationLat: selectedDestination.lat,
        destinationLng: selectedDestination.lng,
        distanceMeters: approxRoadMeters,
        durationMillis: Math.round((approxRoadMeters / 1000 / 38) * 3600 * 1000),
        steps: [],
        pathCoords: [
          {lat: selectedOrigin.lat, lng: selectedOrigin.lng},
          {lat: selectedDestination.lat, lng: selectedDestination.lng},
        ],
        cachedAt: Date.now(),
      });
    }
  }, [isOnline, selectedOrigin, selectedDestination, savedRoutes]);

  const handleRouteComputed = useCallback(
    (computed: SavedOfflineRoute) => {
      setActiveRoute(computed);
      const updated = upsertSavedOfflineRoute(computed);
      onSavedRoutesChange(updated);
    },
    [onSavedRoutesChange]
  );

  const handleSwapEndpoints = () => {
    const prevOrigin = selectedOrigin;
    onSelectOrigin(selectedDestination);
    onSelectDestination(prevOrigin);
  };

  const handleBookmarkOffline = () => {
    if (!activeRoute) return;
    const updated = upsertSavedOfflineRoute(activeRoute);
    onSavedRoutesChange(updated);
    setJustSavedToast(true);
    setTimeout(() => setJustSavedToast(false), 2200);
  };

  const handleLocateButton = () => {
    if (isTrackingGps && userLocation) {
      setPanToTarget({
        lat: userLocation.lat,
        lng: userLocation.lng,
        seq: Date.now(),
      });
    } else {
      onStartGps();
    }
  };

  useEffect(() => {
    if (isTrackingGps && userLocation && !panToTarget) {
      setPanToTarget({
        lat: userLocation.lat,
        lng: userLocation.lng,
        seq: Date.now(),
      });
    }
  }, [isTrackingGps, userLocation, panToTarget]);

  const fareEstimates: FareModeEstimate[] = useMemo(() => {
    if (!activeRoute || activeRoute.distanceMeters <= 0) return [];
    return calculateBoholFares(
      activeRoute.distanceMeters,
      passengers,
      hasDiscount
    );
  }, [activeRoute, passengers, hasDiscount]);

  const liveDistanceToDestKm = useMemo(() => {
    if (!userLocation || !selectedDestination) return null;
    const meters = computeHaversineMeters(
      {lat: userLocation.lat, lng: userLocation.lng},
      {lat: selectedDestination.lat, lng: selectedDestination.lng}
    );
    return (meters / 1000).toFixed(1);
  }, [userLocation, selectedDestination]);

  const hubEntries = useMemo(
    () =>
      BOHOL_HUB_QUERIES.map((cfg) => ({
        cfg,
        place: resolvedHubs[cfg.hubKey],
      })).filter((item): item is {cfg: typeof BOHOL_HUB_QUERIES[number]; place: ResolvedGooglePlace} =>
        Boolean(item.place)
      ),
    [resolvedHubs]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:py-7">
      {/* Workspace Intro & Quick Corridor Strip */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Bohol Route &amp; Fare Navigator
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            Select any terminal, beach, or interior landmark to compare real-road distances,
            jeepney and Southern Star bus fares, and negotiated tricycle charter rates.
          </p>
        </div>

        {/* Live GPS Consent Control */}
        <div className="flex flex-wrap items-center gap-2">
          {isTrackingGps ? (
            <button
              type="button"
              onClick={onStopGps}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-teal-700 bg-teal-50 px-4 py-2 text-xs font-semibold text-teal-900 hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0"
            >
              <LocateFixed className="h-4 w-4 text-teal-700" />
              <span>
                GPS Active
                {userLocation ? ` (±${userLocation.accuracyMeters}m)` : '...'} · Stop Sharing
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartGps}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <LocateFixed className="h-4 w-4 text-teal-700" />
              <span>Track My Live Location</span>
            </button>
          )}
        </div>
      </div>

      {geoError && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          {geoError}
        </div>
      )}

      {/* Main Responsive Split Grid: Controls & Fare Sheet (Left) + Map Canvas (Right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Left Column: Route Planner + Fare Breakdown */}
        <div className="lg:col-span-5 space-y-5 order-2 lg:order-1">
          {/* Origin / Destination Planner Card */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="space-y-3">
              <PlaceSearchInput
                label="Origin (Pickup / Terminal)"
                badgeLetter="A"
                selectedPlace={selectedOrigin}
                onSelectPlace={(p) => onSelectOrigin(p)}
                resolvedHubs={resolvedHubs}
                isOnline={isOnline}
                userLocation={userLocation}
                onRequestLiveGps={onStartGps}
              />

              <div className="flex items-center justify-between pt-0.5">
                <div className="text-xs text-slate-500">
                  Popular stops auto-save for 30-day offline access
                </div>
                <button
                  type="button"
                  onClick={handleSwapEndpoints}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  <span>Swap A / B</span>
                </button>
              </div>

              <PlaceSearchInput
                label="Destination (Beach / Landmark / Town)"
                badgeLetter="B"
                selectedPlace={selectedDestination}
                onSelectPlace={(p) => onSelectDestination(p)}
                resolvedHubs={resolvedHubs}
                isOnline={isOnline}
                userLocation={userLocation}
              />
            </div>

            {/* Quick Corridor Presets */}
            {hubEntries.length >= 2 && (
              <div className="mt-4 border-t border-slate-100 pt-3.5">
                <div className="mb-2 text-xs font-medium text-slate-500">
                  One-Tap Tourist Corridors
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    {
                      label: 'Airport → Alona',
                      from: 'panglao_airport',
                      to: 'alona_beach',
                    },
                    {
                      label: 'Dao → Chocolate Hills',
                      from: 'dao_terminal',
                      to: 'chocolate_hills',
                    },
                    {
                      label: 'Seaport → Alona',
                      from: 'tagbilaran_seaport',
                      to: 'alona_beach',
                    },
                    {
                      label: 'Dao → Tarsier & Loboc',
                      from: 'dao_terminal',
                      to: 'loboc_river',
                    },
                    {
                      label: 'Dao → Anda Beach',
                      from: 'dao_terminal',
                      to: 'anda_beach',
                    },
                  ].map((preset) => {
                    const fromPlace = resolvedHubs[preset.from];
                    const toPlace = resolvedHubs[preset.to];
                    if (!fromPlace || !toPlace) return null;
                    const isCurrent =
                      selectedOrigin?.placeId === fromPlace.placeId &&
                      selectedDestination?.placeId === toPlace.placeId;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          onSelectOrigin(fromPlace);
                          onSelectDestination(toPlace);
                        }}
                        className={`min-h-[40px] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          isCurrent
                            ? 'bg-teal-700 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Passenger & Discount Controls */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3.5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-medium text-slate-700">Riders:</span>
                <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5">
                  <button
                    type="button"
                    onClick={() => setPassengers((p) => Math.max(1, p - 1))}
                    aria-label="Decrease passengers"
                    className="min-h-[36px] min-w-[36px] rounded-md text-sm font-semibold text-slate-800 hover:bg-white transition-colors"
                  >
                    −
                  </button>
                  <span className="min-w-[28px] text-center font-mono text-sm font-semibold tabular-nums text-slate-900">
                    {passengers}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPassengers((p) => Math.min(8, p + 1))}
                    aria-label="Increase passengers"
                    className="min-h-[36px] min-w-[36px] rounded-md text-sm font-semibold text-slate-800 hover:bg-white transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setHasDiscount((d) => !d)}
                className={`min-h-[40px] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  hasDiscount
                    ? 'bg-teal-50 text-teal-800 border border-teal-700/30'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                {hasDiscount ? '✓ 20% Student / Senior' : 'Regular Tourist Fare'}
              </button>
            </div>
          </section>

          {/* Route Summary & Fare Comparison Card */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            {routeLoading && (
              <div className="py-6 text-center text-sm text-slate-600">
                Calculating real Bohol road distance &amp; transit fares...
              </div>
            )}

            {!routeLoading && routeError && (
              <div className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                {routeError}
              </div>
            )}

            {!routeLoading && activeRoute && (
              <>
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="text-xs text-slate-500">
                      Calculated Road Distance &amp; Drive Time
                    </div>
                    <div className="mt-1 flex items-baseline gap-3 font-mono tabular-nums">
                      <span className="text-2xl font-bold text-slate-900">
                        {(activeRoute.distanceMeters / 1000).toFixed(1)} km
                      </span>
                      <span className="text-sm font-medium text-slate-600">
                        · ~{Math.max(3, Math.round(activeRoute.durationMillis / 60000))} min road
                      </span>
                    </div>
                    {liveDistanceToDestKm && (
                      <div className="mt-1 text-xs font-mono tabular-nums text-teal-800">
                        Live GPS straight-line to destination: {liveDistanceToDestKm} km
                        {userLocation?.speedKmh !== null &&
                        userLocation?.speedKmh !== undefined
                          ? ` · ${userLocation.speedKmh} km/h`
                          : ''}
                      </div>
                    )}
                    <div className="mt-1 text-[11px] text-slate-400">
                      Google Maps
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleBookmarkOffline}
                    className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    {justSavedToast ? (
                      <>
                        <BookmarkCheck className="h-4 w-4 text-teal-700" />
                        <span className="text-teal-800">Saved Offline</span>
                      </>
                    ) : (
                      <>
                        <DownloadCloud className="h-4 w-4 text-slate-500" />
                        <span>Save Offline</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Estimated Fares List (No Cards-Within-Cards — clean hairline rows!) */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span>
                      Estimated Fares ({passengers}{' '}
                      {passengers === 1 ? 'passenger' : 'passengers'})
                    </span>
                    <span>PHP · {selectedCurrency}</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {fareEstimates.map((mode) => (
                      <div key={mode.id} className="py-3.5 first:pt-1 last:pb-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-slate-900">
                              {mode.modeName}
                            </h3>
                            <div className="mt-0.5 text-xs text-slate-500">
                              {mode.localName}
                              {mode.isRecommended ? ' · Best fit for distance' : ''}
                            </div>
                          </div>

                          <div className="text-right shrink-0 font-mono tabular-nums">
                            <div className="text-base font-semibold text-slate-900">
                              ₱{mode.totalPhp.toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatConverted(mode.totalPhp)}
                              {passengers > 1 ? ` · ₱${mode.perPersonPhp}/pax` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                          {mode.boardingNote}
                        </div>
                        <div className="mt-1 text-xs font-mono tabular-nums text-slate-500">
                          Typical range: ₱{mode.rangeMinPhp}–₱{mode.rangeMaxPhp}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Turn-by-turn steps toggle (works offline once cached!) */}
                {activeRoute.steps.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowSteps((s) => !s)}
                      className="flex w-full min-h-[44px] items-center justify-between text-left text-xs font-semibold text-teal-800 hover:text-teal-900"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Navigation className="h-3.5 w-3.5" />
                        {showSteps
                          ? 'Hide Turn-by-Turn Road Directions'
                          : `View ${activeRoute.steps.length} Road Navigation Steps (Offline Ready)`}
                      </span>
                      <span>{showSteps ? '−' : '+'}</span>
                    </button>

                    {showSteps && (
                      <div className="mt-2 max-h-60 overflow-y-auto divide-y divide-slate-100 pr-1">
                        {activeRoute.steps.map((step, index) => (
                          <div
                            key={`${index}-${step.distanceMeters}`}
                            className="flex items-start justify-between gap-3 py-2 text-xs"
                          >
                            <span className="text-slate-700">
                              <span className="font-mono text-slate-400 mr-1.5">
                                {String(index + 1).padStart(2, '0')}.
                              </span>
                              {step.instruction}
                            </span>
                            <span className="shrink-0 font-mono tabular-nums text-slate-500">
                              {step.distanceMeters >= 1000
                                ? `${(step.distanceMeters / 1000).toFixed(1)} km`
                                : `${step.distanceMeters} m`}
                            </span>
                          </div>
                        ))}
                        <div className="pt-2 text-[11px] text-slate-400">
                          Google Maps
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {!routeLoading && !activeRoute && (
              <div className="py-6 text-center text-sm text-slate-500">
                Choose an origin and destination in Bohol to view route fares and
                navigation.
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Interactive Mobile-Optimized Map Canvas (or Offline Schematic) */}
        <div className="lg:col-span-7 order-1 lg:order-2">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 h-[390px] sm:h-[480px] lg:h-[680px]">
            {isOnline ? (
              <>
                <Map
                  mapId="DEMO_MAP_ID"
                  defaultCenter={BOHOL_ISLAND_CENTER}
                  defaultZoom={10}
                  mapTypeId={mapTypeId}
                  gestureHandling="greedy"
                  disableDefaultUI={true}
                  zoomControl={true}
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  className="h-full w-full"
                >
                  <MapServicesController
                    origin={selectedOrigin}
                    destination={selectedDestination}
                    isOnline={isOnline}
                    onRouteComputed={handleRouteComputed}
                    onRouteError={setRouteError}
                    onLoadingChange={setRouteLoading}
                    resolvedHubs={resolvedHubs}
                    onHubsUpdated={onHubsUpdated}
                    panToTarget={panToTarget}
                  />

                  {/* Bohol Transit Hubs & Landmarks Markers */}
                  {hubEntries.map(({cfg, place}) => {
                    const isEndpoint =
                      selectedOrigin?.placeId === place.placeId ||
                      selectedDestination?.placeId === place.placeId;
                    if (isEndpoint) return null;
                    return (
                      <AdvancedMarker
                        key={cfg.hubKey}
                        position={{lat: place.lat, lng: place.lng}}
                        title={place.displayName}
                        onClick={() => setActiveHubPopup(place)}
                      >
                        <Pin
                          background={cfg.isTerminal ? '#0f766e' : '#334155'}
                          borderColor="#ffffff"
                          glyphColor="#ffffff"
                          scale={0.95}
                        />
                      </AdvancedMarker>
                    );
                  })}

                  {/* Origin Marker (A) */}
                  {selectedOrigin && (
                    <AdvancedMarker
                      position={{lat: selectedOrigin.lat, lng: selectedOrigin.lng}}
                      title={`Origin: ${selectedOrigin.displayName}`}
                      onClick={() => setActiveHubPopup(selectedOrigin)}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-teal-700 font-mono text-xs font-bold text-white shadow-md">
                        A
                      </div>
                    </AdvancedMarker>
                  )}

                  {/* Destination Marker (B) */}
                  {selectedDestination && (
                    <AdvancedMarker
                      position={{
                        lat: selectedDestination.lat,
                        lng: selectedDestination.lng,
                      }}
                      title={`Destination: ${selectedDestination.displayName}`}
                      onClick={() => setActiveHubPopup(selectedDestination)}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-900 font-mono text-xs font-bold text-white shadow-md">
                        B
                      </div>
                    </AdvancedMarker>
                  )}

                  {/* Real-Time User GPS Marker */}
                  {userLocation && (
                    <AdvancedMarker
                      position={{lat: userLocation.lat, lng: userLocation.lng}}
                      title="My Live GPS Location"
                    >
                      <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-sky-600 shadow-md" />
                    </AdvancedMarker>
                  )}

                  {/* Interactive InfoWindow on Marker Tap */}
                  {activeHubPopup && (
                    <InfoWindow
                      position={{lat: activeHubPopup.lat, lng: activeHubPopup.lng}}
                      maxWidth={260}
                      onCloseClick={() => setActiveHubPopup(null)}
                    >
                      <div className="p-1 text-slate-900">
                        <div className="text-sm font-semibold">
                          {activeHubPopup.displayName}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-600">
                          {activeHubPopup.formattedAddress}
                          {activeHubPopup.rating
                            ? ` · ★ ${activeHubPopup.rating.toFixed(1)}`
                            : ''}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">
                          Google Maps
                        </div>
                        <div className="mt-2.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectOrigin(activeHubPopup);
                              setActiveHubPopup(null);
                            }}
                            className="min-h-[36px] flex-1 rounded-lg bg-teal-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
                          >
                            Set Origin
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectDestination(activeHubPopup);
                              setActiveHubPopup(null);
                            }}
                            className="min-h-[36px] flex-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                          >
                            Set Dest
                          </button>
                        </div>
                      </div>
                    </InfoWindow>
                  )}
                </Map>

                {/* Floating Map Layer & GPS Controls (44x44px hitboxes) */}
                <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setMapTypeId((prev) =>
                        prev === 'roadmap'
                          ? 'terrain'
                          : prev === 'terrain'
                            ? 'hybrid'
                            : 'roadmap'
                      )
                    }
                    title="Switch Map Layer"
                    className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white/95 backdrop-blur-md px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-white transition-colors"
                  >
                    <Layers className="h-4 w-4 text-teal-700" />
                    <span className="capitalize">{mapTypeId}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLocateButton}
                    title="Center on My GPS Location"
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center self-end rounded-xl border border-slate-200 bg-white/95 backdrop-blur-md text-slate-800 shadow-sm hover:bg-white transition-colors"
                  >
                    <LocateFixed
                      className={`h-4 w-4 ${
                        isTrackingGps ? 'text-teal-700' : 'text-slate-600'
                      }`}
                    />
                  </button>
                </div>
              </>
            ) : (
              /* Offline Cached Route & GPS Compass Navigator */
              <div className="flex h-full w-full flex-col justify-between bg-slate-900 p-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 text-xs font-medium text-amber-300">
                      <WifiOff className="h-4 w-4" />
                      <span>Offline Navigation Canvas</span>
                    </div>
                    <h2 className="mt-1 text-lg font-semibold">
                      {activeRoute
                        ? `${activeRoute.originName} → ${activeRoute.destinationName}`
                        : 'Saved Bohol Offline Navigator'}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-300">
                      Using cached route geometry and live device GPS (no mobile data required).
                    </p>
                  </div>
                  <Compass className="h-6 w-6 text-teal-400 shrink-0" />
                </div>

                {/* SVG Cached Polyline Plot */}
                {activeRoute && activeRoute.pathCoords.length >= 2 && (
                  <div className="my-4 flex-1 flex items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    {(() => {
                      const pts = activeRoute.pathCoords;
                      const lats = pts.map((p) => p.lat);
                      const lngs = pts.map((p) => p.lng);
                      if (userLocation) {
                        lats.push(userLocation.lat);
                        lngs.push(userLocation.lng);
                      }
                      const minLat = Math.min(...lats);
                      const maxLat = Math.max(...lats);
                      const minLng = Math.min(...lngs);
                      const maxLng = Math.max(...lngs);
                      const dLat = Math.max(0.005, maxLat - minLat);
                      const dLng = Math.max(0.005, maxLng - minLng);

                      const toSvg = (lat: number, lng: number) => ({
                        x: 24 + ((lng - minLng) / dLng) * 252,
                        y: 156 - ((lat - minLat) / dLat) * 132,
                      });

                      const polyPoints = pts
                        .map((p) => {
                          const s = toSvg(p.lat, p.lng);
                          return `${s.x.toFixed(1)},${s.y.toFixed(1)}`;
                        })
                        .join(' ');

                      const startSvg = toSvg(pts[0].lat, pts[0].lng);
                      const endSvg = toSvg(
                        pts[pts.length - 1].lat,
                        pts[pts.length - 1].lng
                      );
                      const gpsSvg = userLocation
                        ? toSvg(userLocation.lat, userLocation.lng)
                        : null;

                      return (
                        <svg
                          viewBox="0 0 300 180"
                          className="h-full max-h-56 w-full"
                          role="img"
                          aria-label="Cached Bohol route vector path"
                        >
                          <polyline
                            fill="none"
                            stroke="#14b8a6"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={polyPoints}
                          />
                          <circle
                            cx={startSvg.x}
                            cy={startSvg.y}
                            r="6"
                            fill="#0f766e"
                            stroke="#ffffff"
                            strokeWidth="2"
                          />
                          <circle
                            cx={endSvg.x}
                            cy={endSvg.y}
                            r="6"
                            fill="#f59e0b"
                            stroke="#ffffff"
                            strokeWidth="2"
                          />
                          {gpsSvg && (
                            <circle
                              cx={gpsSvg.x}
                              cy={gpsSvg.y}
                              r="5"
                              fill="#38bdf8"
                              stroke="#ffffff"
                              strokeWidth="2"
                            />
                          )}
                        </svg>
                      );
                    })()}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3 text-xs text-slate-300">
                  <span>
                    Saved offline corridors: {savedRoutes.length} · Cached stops:{' '}
                    {Object.keys(resolvedHubs).length}
                  </span>
                  {userLocation && (
                    <span className="font-mono tabular-nums text-teal-300">
                      GPS: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
