import {useCallback, useEffect, useState} from 'react';
import {FALLBACK_PHP_RATES, SUPPORTED_CURRENCIES} from '../data/boholTransitData';
import {getPreferredCurrency, setPreferredCurrency} from '../utils/offlineStorage';

const RATES_STORAGE_KEY = 'sakay_bohol_fx_rates_v1';

interface StoredRatesPayload {
  rates: Record<string, number>;
  dateLabel: string;
  isLive: boolean;
}

export function useCurrencyRates() {
  const [selectedCurrency, setSelectedCurrencyState] = useState<string>(() =>
    getPreferredCurrency()
  );
  const [ratesState, setRatesState] = useState<StoredRatesPayload>(() => {
    try {
      const cached = localStorage.getItem(RATES_STORAGE_KEY);
      if (cached) {
        return JSON.parse(cached) as StoredRatesPayload;
      }
    } catch {
      // Fallback
    }
    return {
      rates: FALLBACK_PHP_RATES,
      dateLabel: 'Offline reference rates',
      isLive: false,
    };
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshRates = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    setIsRefreshing(true);
    try {
      const symbols = SUPPORTED_CURRENCIES.map((c) => c.code).join(',');
      const res = await fetch(
        `https://api.frankfurter.app/latest?from=PHP&to=${symbols}`
      );
      if (!res.ok) throw new Error('FX fetch failed');
      const data = (await res.json()) as {
        date?: string;
        rates?: Record<string, number>;
      };
      if (data.rates) {
        const merged: Record<string, number> = {
          ...FALLBACK_PHP_RATES,
          ...data.rates,
          PHP: 1,
        };
        const payload: StoredRatesPayload = {
          rates: merged,
          dateLabel: data.date ? `ECB / Frankfurter (${data.date})` : 'Live FX synced',
          isLive: true,
        };
        setRatesState(payload);
        try {
          localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(payload));
        } catch {
          // Ignore
        }
      }
    } catch {
      // Retain cached/fallback rates silently for offline resilience
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshRates();
  }, [refreshRates]);

  const setCurrency = useCallback((code: string) => {
    setSelectedCurrencyState(code);
    setPreferredCurrency(code);
  }, []);

  const formatConverted = useCallback(
    (phpAmount: number, currencyCode: string = selectedCurrency): string => {
      const rate = ratesState.rates[currencyCode] ?? FALLBACK_PHP_RATES[currencyCode] ?? 0.0173;
      const meta = SUPPORTED_CURRENCIES.find((c) => c.code === currencyCode);
      const symbol = meta?.symbol ?? `${currencyCode} `;
      const converted = phpAmount * rate;
      if (currencyCode === 'KRW' || currencyCode === 'JPY') {
        return `${symbol}${Math.round(converted).toLocaleString()}`;
      }
      return `${symbol}${converted.toFixed(2)}`;
    },
    [ratesState.rates, selectedCurrency]
  );

  return {
    selectedCurrency,
    setCurrency,
    rates: ratesState.rates,
    rateSourceLabel: ratesState.dateLabel,
    isLiveRates: ratesState.isLive,
    isRefreshing,
    refreshRates,
    formatConverted,
  };
}
