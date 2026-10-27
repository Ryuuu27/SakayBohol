import React, {useState} from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  Download,
  RefreshCw,
  Share,
  Smartphone,
  Trash2,
} from 'lucide-react';
import {FALLBACK_PHP_RATES, SUPPORTED_CURRENCIES} from '../data/boholTransitData';
import {usePWAInstall} from '../hooks/usePWAInstall';
import {SavedOfflineRoute} from '../types/transit';
import {
  clearAllOfflineCache,
  GMP_CACHE_TTL_MS,
  removeSavedOfflineRoute,
} from '../utils/offlineStorage';

interface CurrencyAndOfflineViewProps {
  selectedCurrency: string;
  onSelectCurrency: (code: string) => void;
  rates: Record<string, number>;
  rateSourceLabel: string;
  isRefreshingRates: boolean;
  onRefreshRates: () => void;
  savedRoutes: SavedOfflineRoute[];
  onSavedRoutesChange: (routes: SavedOfflineRoute[]) => void;
  onLoadSavedRouteToMap: (route: SavedOfflineRoute) => void;
  onClearHubCache: () => void;
}

export const CurrencyAndOfflineView: React.FC<CurrencyAndOfflineViewProps> = ({
  selectedCurrency,
  onSelectCurrency,
  rates,
  rateSourceLabel,
  isRefreshingRates,
  onRefreshRates,
  savedRoutes,
  onSavedRoutesChange,
  onLoadSavedRouteToMap,
  onClearHubCache,
}) => {
  const [phpInput, setPhpInput] = useState<string>('150');
  const [directionPhpToForeign, setDirectionPhpToForeign] = useState(true);
  const [showIOSModal, setShowIOSModal] = useState(false);

  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();

  const activeRate =
    rates[selectedCurrency] ?? FALLBACK_PHP_RATES[selectedCurrency] ?? 0.0173;
  const currencyMeta = SUPPORTED_CURRENCIES.find(
    (c) => c.code === selectedCurrency
  );

  const numericInput = Math.max(0, parseFloat(phpInput) || 0);
  const convertedResult = directionPhpToForeign
    ? numericInput * activeRate
    : activeRate > 0
      ? numericInput / activeRate
      : 0;

  const formattedResult = directionPhpToForeign
    ? selectedCurrency === 'KRW' || selectedCurrency === 'JPY'
      ? `${currencyMeta?.symbol ?? ''}${Math.round(convertedResult).toLocaleString()}`
      : `${currencyMeta?.symbol ?? ''}${convertedResult.toFixed(2)}`
    : `₱${Math.round(convertedResult).toLocaleString()}`;

  const handleRemoveRoute = (id: string) => {
    const next = removeSavedOfflineRoute(id);
    onSavedRoutesChange(next);
  };

  const handlePurgeAll = () => {
    clearAllOfflineCache();
    onSavedRoutesChange([]);
    onClearHubCache();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Currency Converter &amp; Mobile Offline Access
        </h1>
        <p className="mt-1 text-sm text-slate-600 max-w-2xl">
          Convert Philippine Pesos (₱ PHP) for tricycle and bus fares even without cell
          signal, and install Sakay Bohol on Android or iOS for instant home-screen access.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Built-in PHP Currency Converter */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                01. Philippine Peso (PHP) Transit Converter
              </h2>
              <div className="mt-0.5 text-xs text-slate-500">
                {rateSourceLabel} · Syncs fare equivalents across the entire app
              </div>
            </div>
            <button
              type="button"
              onClick={onRefreshRates}
              disabled={isRefreshingRates}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshingRates ? 'animate-spin' : ''}`}
              />
              <span>Refresh FX</span>
            </button>
          </div>

          {/* Currency Selector Grid */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Your Home Currency (Shown alongside ₱ PHP fares)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SUPPORTED_CURRENCIES.map((cur) => (
                <button
                  key={cur.code}
                  type="button"
                  onClick={() => onSelectCurrency(cur.code)}
                  className={`min-h-[40px] rounded-lg px-3 py-1.5 text-xs font-semibold font-mono transition-colors whitespace-nowrap shrink-0 ${
                    selectedCurrency === cur.code
                      ? 'bg-teal-700 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                  }`}
                >
                  {cur.code} ({cur.symbol})
                </button>
              ))}
            </div>
          </div>

          {/* Two-Way Conversion Input */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-11 sm:items-end pt-1">
            <div className="sm:col-span-5">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {directionPhpToForeign
                  ? 'Amount in Philippine Pesos (₱ PHP)'
                  : `Amount in ${selectedCurrency}`}
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={phpInput}
                onChange={(e) => setPhpInput(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 font-mono text-lg font-semibold tabular-nums text-slate-900 focus:border-teal-700 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="sm:col-span-1 flex justify-center">
              <button
                type="button"
                onClick={() => setDirectionPhpToForeign((d) => !d)}
                aria-label="Swap conversion direction"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
            </div>

            <div className="sm:col-span-5">
              <div className="block text-xs font-medium text-slate-600 mb-1">
                {directionPhpToForeign
                  ? `Converted (${selectedCurrency} — ${currencyMeta?.name ?? ''})`
                  : 'Converted in Philippine Pesos (₱ PHP)'}
              </div>
              <div className="flex min-h-[48px] items-center rounded-xl border border-teal-700/25 bg-teal-50/60 px-4 py-2.5 font-mono text-xl font-bold tabular-nums text-teal-950">
                {formattedResult}
              </div>
            </div>
          </div>

          {/* Quick Peso Bill Presets */}
          {directionPhpToForeign && (
            <div className="border-t border-slate-100 pt-4">
              <div className="text-xs font-medium text-slate-600 mb-2">
                Common Bohol Fare &amp; Banknote Denominations
              </div>
              <div className="flex flex-wrap gap-2">
                {[15, 20, 50, 100, 150, 300, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setPhpInput(String(amt))}
                    className="min-h-[40px] rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs font-medium tabular-nums text-slate-800 hover:bg-slate-50 transition-colors"
                  >
                    ₱{amt}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                Cash tip: Jeepney and tricycle drivers rarely carry change for ₱500 or
                ₱1,000 banknotes early in the morning. Keep ₱20 coins/notes, ₱50, and ₱100
                bills ready in a small pouch.
              </p>
            </div>
          )}
        </section>

        {/* Right: Android & iOS PWA Installation + Offline Route Vault */}
        <div className="lg:col-span-5 space-y-6">
          {/* Android & iOS Install Card (Mandatory In-App Install UI) */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Smartphone className="h-5 w-5 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  02. Install on Android &amp; iOS
                </h2>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Install Sakay Bohol to your phone home screen for full-screen standalone
                  launch and instant offline access to schedules, fares, and Cebuano phrases.
                </p>
              </div>
            </div>

            {isInstalled ? (
              <div className="flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-3 text-xs font-semibold text-teal-900">
                <CheckCircle2 className="h-4 w-4 text-teal-700 shrink-0" />
                <span>Installed as Standalone App · Offline assets active</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 sm:flex-row">
                {isInstallable && (
                  <button
                    type="button"
                    onClick={() => void install()}
                    className="min-h-[46px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 transition-colors whitespace-nowrap"
                  >
                    <Download className="h-4 w-4" />
                    <span>Install App (Android / Chrome)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowIOSModal(true)}
                  className="min-h-[46px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <Share className="h-4 w-4 text-teal-700" />
                  <span>{isIOS ? 'Install on iPhone / iPad' : 'iOS & Android Guide'}</span>
                </button>
              </div>
            )}
          </section>

          {/* Saved Offline Routes Vault */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  03. Offline Route Cache ({savedRoutes.length})
                </h2>
                <div className="text-xs text-slate-500">
                  Auto-expires after 30 days per Google Maps terms
                </div>
              </div>
              {savedRoutes.length > 0 && (
                <button
                  type="button"
                  onClick={handlePurgeAll}
                  className="min-h-[40px] inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-red-700 transition-colors whitespace-nowrap shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            {savedRoutes.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 leading-relaxed">
                Any route you preview on the Live Map is automatically cached here so
                its distance, turn-by-turn steps, and tricycle/jeepney fares work offline.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {savedRoutes.map((route) => {
                  const daysLeft = Math.max(
                    1,
                    Math.ceil(
                      (GMP_CACHE_TTL_MS - (Date.now() - route.cachedAt)) /
                        (24 * 60 * 60 * 1000)
                    )
                  );
                  return (
                    <div
                      key={route.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"
                    >
                      <button
                        type="button"
                        onClick={() => onLoadSavedRouteToMap(route)}
                        className="min-w-0 flex-1 text-left hover:opacity-80"
                      >
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {route.originName} → {route.destinationName}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500">
                          {(route.distanceMeters / 1000).toFixed(1)} km ·{' '}
                          {route.steps.length} steps · Expires in {daysLeft}d
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveRoute(route.id)}
                        aria-label="Remove saved route"
                        className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* iOS Safari & Android Home-Screen Guide Modal */}
      {showIOSModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowIOSModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900">
              Add Sakay Bohol to Your Phone
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <div>
                <div className="font-semibold text-slate-900">
                  On iPhone or iPad (Safari):
                </div>
                <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                  1. Tap the <strong>Share</strong> icon in the bottom Safari toolbar.
                  <br />
                  2. Scroll down and tap <strong>Add to Home Screen</strong>.
                  <br />
                  3. Tap <strong>Add</strong> to launch Sakay Bohol like a native app
                  with offline caching.
                </p>
              </div>
              <div className="border-t border-slate-100 pt-3">
                <div className="font-semibold text-slate-900">
                  On Android (Chrome):
                </div>
                <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                  1. Tap the <strong>Install App</strong> button or Chrome&rsquo;s{' '}
                  <strong>⋮ Menu</strong> in the top corner.
                  <br />
                  2. Select <strong>Install app</strong> or{' '}
                  <strong>Add to Home screen</strong>.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="min-h-[46px] w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
