/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {useCallback, useEffect, useState} from 'react';
import {APIProvider} from '@vis.gl/react-google-maps';
import {
  Bus,
  Coins,
  Languages,
  Map as MapIcon,
  PhoneCall,
  WifiOff,
} from 'lucide-react';
import {BoholMapWorkspace} from './components/BoholMapWorkspace';
import {CebuanoPhrasebookView} from './components/CebuanoPhrasebookView';
import {CurrencyAndOfflineView} from './components/CurrencyAndOfflineView';
import {EmergencyModal} from './components/EmergencyModal';
import {SchedulesAndFaresView} from './components/SchedulesAndFaresView';
import {useCurrencyRates} from './hooks/useCurrencyRates';
import {useGeolocation} from './hooks/useGeolocation';
import {useOnlineStatus} from './hooks/usePWAInstall';
import {AppTab, ResolvedGooglePlace, SavedOfflineRoute} from './types/transit';
import {loadCachedHubs, loadSavedOfflineRoutes} from './utils/offlineStorage';

const GOOGLE_MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? '';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.MAP);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const [resolvedHubs, setResolvedHubs] = useState<
    Record<string, ResolvedGooglePlace>
  >(() => loadCachedHubs());
  const [savedRoutes, setSavedRoutes] = useState<SavedOfflineRoute[]>(() =>
    loadSavedOfflineRoutes()
  );

  const [selectedOrigin, setSelectedOrigin] =
    useState<ResolvedGooglePlace | null>(null);
  const [selectedDestination, setSelectedDestination] =
    useState<ResolvedGooglePlace | null>(null);

  const isOnline = useOnlineStatus();
  const {
    isTracking: isTrackingGps,
    userLocation,
    geoError,
    startTracking,
    stopTracking,
  } = useGeolocation();

  const {
    selectedCurrency,
    setCurrency,
    rates,
    rateSourceLabel,
    isRefreshing,
    refreshRates,
    formatConverted,
  } = useCurrencyRates();

  // Listen at top-level context for Google Maps Demo Key quota exhaustion
  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  const handleOpenCorridorOnMap = useCallback(
    (originKey: string, destKey: string) => {
      const originPlace = resolvedHubs[originKey];
      const destPlace = resolvedHubs[destKey];
      if (originPlace) setSelectedOrigin(originPlace);
      if (destPlace) setSelectedDestination(destPlace);
      setActiveTab(AppTab.MAP);
      window.scrollTo({top: 0, behavior: 'smooth'});
    },
    [resolvedHubs]
  );

  const handleLoadSavedRoute = useCallback((route: SavedOfflineRoute) => {
    const [originId, destId] = route.id.split('__');
    setSelectedOrigin({
      placeId: originId || 'saved_origin',
      displayName: route.originName,
      formattedAddress: route.originAddress,
      lat: route.originLat,
      lng: route.originLng,
      cachedAt: route.cachedAt,
    });
    setSelectedDestination({
      placeId: destId || 'saved_dest',
      displayName: route.destinationName,
      formattedAddress: route.destinationAddress,
      lat: route.destinationLat,
      lng: route.destinationLng,
      cachedAt: route.cachedAt,
    });
    setActiveTab(AppTab.MAP);
    window.scrollTo({top: 0, behavior: 'smooth'});
  }, []);

  const navItems: Array<{
    tab: AppTab;
    label: string;
    shortLabel: string;
    icon: React.FC<{className?: string}>;
  }> = [
    {tab: AppTab.MAP, label: 'Live Map', shortLabel: 'Map', icon: MapIcon},
    {
      tab: AppTab.SCHEDULES,
      label: 'Schedules & Fares',
      shortLabel: 'Schedules',
      icon: Bus,
    },
    {
      tab: AppTab.PHRASES,
      label: 'Phrasebook',
      shortLabel: 'Cebuano',
      icon: Languages,
    },
    {
      tab: AppTab.CURRENCY,
      label: 'Currency & App',
      shortLabel: 'Currency',
      icon: Coins,
    },
  ];

  const mainContent = (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 pb-16 md:pb-0">
      {/* Required Google Maps Platform Demo Quota Banner (Case A) */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Strict 3-Zone Top Bar Contract (Compact 52px height on mobile to stay well within 15% sticky cap) */}
      <header className="sticky top-0 z-30 flex h-13 md:h-16 items-center justify-between gap-8 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 sm:px-6">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab(AppTab.MAP);
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          Sakay Bohol
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
        >
          {navItems.map((item) => {
            const active = activeTab === item.tab;
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => setActiveTab(item.tab)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  active
                    ? 'border-teal-700 text-slate-900 font-semibold'
                    : 'border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action (Local Emergency Contact SOS) */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setEmergencyOpen(true)}
            className="min-h-[40px] md:min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors whitespace-nowrap shrink-0"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            <span>Emergency SOS</span>
          </button>
        </div>
      </header>

      {/* Non-intrusive Offline Connectivity Notice */}
      {!isOnline && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-950">
          <WifiOff className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
          Offline Mode — Using cached Bohol routes, jeepney schedules, currency rates, and
          Cebuano phrasebook.
        </div>
      )}

      {/* Active Workspace View */}
      <main className="flex-1">
        {activeTab === AppTab.MAP && (
          <BoholMapWorkspace
            resolvedHubs={resolvedHubs}
            onHubsUpdated={setResolvedHubs}
            savedRoutes={savedRoutes}
            onSavedRoutesChange={setSavedRoutes}
            selectedOrigin={selectedOrigin}
            selectedDestination={selectedDestination}
            onSelectOrigin={setSelectedOrigin}
            onSelectDestination={setSelectedDestination}
            isOnline={isOnline}
            isTrackingGps={isTrackingGps}
            userLocation={userLocation}
            geoError={geoError}
            onStartGps={startTracking}
            onStopGps={stopTracking}
            selectedCurrency={selectedCurrency}
            formatConverted={formatConverted}
          />
        )}

        {activeTab === AppTab.SCHEDULES && (
          <SchedulesAndFaresView
            resolvedHubs={resolvedHubs}
            selectedCurrency={selectedCurrency}
            formatConverted={formatConverted}
            onOpenCorridorOnMap={handleOpenCorridorOnMap}
          />
        )}

        {activeTab === AppTab.PHRASES && <CebuanoPhrasebookView />}

        {activeTab === AppTab.CURRENCY && (
          <CurrencyAndOfflineView
            selectedCurrency={selectedCurrency}
            onSelectCurrency={setCurrency}
            rates={rates}
            rateSourceLabel={rateSourceLabel}
            isRefreshingRates={isRefreshing}
            onRefreshRates={() => void refreshRates()}
            savedRoutes={savedRoutes}
            onSavedRoutesChange={setSavedRoutes}
            onLoadSavedRouteToMap={handleLoadSavedRoute}
            onClearHubCache={() => setResolvedHubs({})}
          />
        )}
      </main>

      {/* Quiet Compliance & Privacy Footer */}
      <footer className="border-t border-slate-200 bg-white py-5 px-4 sm:px-6 text-xs text-slate-500">
        <div className="mx-auto max-w-7xl flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Sakay Bohol · Tourist Route, Jeepney Schedule &amp; Tricycle Fare Companion
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Integrates Google Maps features</span>
            <span aria-hidden="true">·</span>
            <a
              href="https://maps.google.com/help/terms_maps/?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-800"
            >
              Google Maps Terms
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://policies.google.com/privacy?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-800"
            >
              Google Privacy Policy
            </a>
          </div>
        </div>
      </footer>

      {/* Mobile Fixed Bottom Tab Bar (56px height; total mobile sticky = 52+56 = 108px < 15% viewport cap) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 grid h-14 grid-cols-4 items-center border-t border-slate-200 bg-white/95 backdrop-blur-md"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => setActiveTab(item.tab)}
              className={`flex min-h-[48px] flex-col items-center justify-center transition-colors ${
                active ? 'text-teal-700' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="mt-0.5 text-[10px] font-medium tracking-tight whitespace-nowrap">
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Emergency Contacts Modal */}
      <EmergencyModal
        isOpen={emergencyOpen}
        onClose={() => setEmergencyOpen(false)}
        userLocation={userLocation}
        onStartGps={startTracking}
      />
    </div>
  );

  if (!GOOGLE_MAPS_API_KEY) {
    return mainContent;
  }

  return (
    <APIProvider
      apiKey={GOOGLE_MAPS_API_KEY}
      language="en"
      region="PH"
      libraries={['places', 'routes', 'marker']}
    >
      {mainContent}
    </APIProvider>
  );
}
