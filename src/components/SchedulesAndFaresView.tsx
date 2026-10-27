import React, {useMemo, useState} from 'react';
import {ArrowRight, Bus, Clock, Compass, SlidersHorizontal} from 'lucide-react';
import {
  BOHOL_JEEPNEY_SCHEDULES,
  calculateBoholFares,
  CORRIDOR_IMAGES,
} from '../data/boholTransitData';
import {JeepneyScheduleCorridor, ResolvedGooglePlace} from '../types/transit';

function getManilaMinutesSinceMidnight(): {minutes: number; formatted: string} {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '8') % 24;
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    const display = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(now);
    return {minutes: hour * 60 + minute, formatted: display};
  } catch {
    return {minutes: 9 * 60, formatted: '9:00 AM'};
  }
}

function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatHm12(totalMins: number): string {
  const h24 = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function computeNextDepartureStatus(
  corridor: JeepneyScheduleCorridor,
  manilaMinutes: number
): {statusLabel: string; isOperating: boolean} {
  const first = parseHm(corridor.firstTripTime);
  const last = parseHm(corridor.lastTripTime);

  if (manilaMinutes < first) {
    return {
      statusLabel: `First trip departs ${formatHm12(first)} PHT`,
      isOperating: false,
    };
  }
  if (manilaMinutes > last) {
    return {
      statusLabel: `Service ended · Resumes ${formatHm12(first)} tomorrow`,
      isOperating: false,
    };
  }

  const elapsed = manilaMinutes - first;
  const nextOffset =
    Math.ceil(elapsed / corridor.headwayMinutes) * corridor.headwayMinutes;
  const nextTime = Math.min(last, first + nextOffset);
  const waitMins = Math.max(1, nextTime - manilaMinutes);

  return {
    statusLabel: `Est. next bus ~${formatHm12(nextTime)} (in ~${waitMins} min)`,
    isOperating: true,
  };
}

interface ResilientPhotoProps {
  src: string;
  alt: string;
  title: string;
  subtitle: string;
}

const ResilientCorridorPhoto: React.FC<ResilientPhotoProps> = ({
  src,
  alt,
  title,
  subtitle,
}) => {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative h-52 overflow-hidden rounded-2xl bg-slate-900">
      {!failed ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-900 via-slate-900 to-slate-800">
          <Compass className="h-10 w-10 text-teal-400/60" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
        <h3 className="text-base font-semibold leading-snug">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-200">{subtitle}</p>
      </div>
    </div>
  );
};

interface SchedulesAndFaresViewProps {
  resolvedHubs: Record<string, ResolvedGooglePlace>;
  selectedCurrency: string;
  formatConverted: (php: number) => string;
  onOpenCorridorOnMap: (originKey: string, destKey: string) => void;
}

export const SchedulesAndFaresView: React.FC<SchedulesAndFaresViewProps> = ({
  resolvedHubs,
  selectedCurrency,
  formatConverted,
  onOpenCorridorOnMap,
}) => {
  const [corridorFilter, setCorridorFilter] = useState<
    'ALL' | 'PANGLAO' | 'INTERIOR' | 'EAST'
  >('ALL');
  const [customKm, setCustomKm] = useState<number>(8);
  const [customPax, setCustomPax] = useState<number>(2);

  const manilaClock = useMemo(() => getManilaMinutesSinceMidnight(), []);

  const filteredCorridors = useMemo(() => {
    return BOHOL_JEEPNEY_SCHEDULES.filter((c) => {
      if (corridorFilter === 'ALL') return true;
      if (corridorFilter === 'PANGLAO') {
        return (
          c.id === 'airport_alona_tagbilaran' ||
          c.id === 'tagbilaran_dauis_hinagdanan'
        );
      }
      if (corridorFilter === 'INTERIOR') {
        return (
          c.id === 'tagbilaran_chocolate_hills' ||
          c.id === 'tagbilaran_corella_tarsier' ||
          c.id === 'tagbilaran_loboc_express'
        );
      }
      return c.id === 'tagbilaran_anda_east';
    });
  }, [corridorFilter]);

  const customFareTable = useMemo(
    () => calculateBoholFares(customKm * 1000, customPax, false),
    [customKm, customPax]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8 space-y-10">
      {/* Header & Visual Bohol Transit Corridors */}
      <section>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Jeepney Timetables &amp; Tricycle Tariffs
            </h1>
            <p className="mt-1 text-sm text-slate-600 max-w-2xl">
              Departure intervals from Dao Integrated Bus Terminal, Panglao Airport, and
              Tagbilaran Seaport, calibrated to Philippine Standard Time ({manilaClock.formatted} PHT).
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-500">
            Local Time (Bohol) · {manilaClock.formatted} PHT
          </div>
        </div>

        {/* 3 Regional Visual Cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <ResilientCorridorPhoto
            src={CORRIDOR_IMAGES.interiorHills}
            alt="Traditional Bohol jeepney along karst hills road toward Carmen"
            title="Interior Karst & Chocolate Hills"
            subtitle="Dao Terminal · Corella · Loboc · Carmen · ₱30–₱120"
          />
          <ResilientCorridorPhoto
            src={CORRIDOR_IMAGES.panglaoCoast}
            alt="Bohol passenger tricycle along Panglao turquoise coast"
            title="Panglao Coast & Airport Loop"
            subtitle="Tagbilaran · Dauis · Airport · Alona Beach · ₱50–₱250"
          />
          <ResilientCorridorPhoto
            src={CORRIDOR_IMAGES.lobocValley}
            alt="Emerald Loboc River valley in interior Bohol"
            title="Loboc River & East Coast"
            subtitle="Baclayon · Loay · Loboc · Jagna · Anda · ₱45–₱195"
          />
        </div>
      </section>

      {/* Jeepney & Southern Star Bus Timetables */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              01. Island Jeepney &amp; Bus Departure Schedules
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              All schedules stored locally for full offline lookup across rural Bohol.
            </p>
          </div>

          {/* Functional Segmented Filter Buttons */}
          <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 self-start">
            {(
              [
                {key: 'ALL', label: 'All Routes'},
                {key: 'PANGLAO', label: 'Panglao'},
                {key: 'INTERIOR', label: 'Hills & Loboc'},
                {key: 'EAST', label: 'Anda East'},
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCorridorFilter(tab.key)}
                className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  corridorFilter === tab.key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredCorridors.map((corridor) => {
            const liveStatus = computeNextDepartureStatus(
              corridor,
              manilaClock.minutes
            );
            const canJumpToMap = Boolean(
              resolvedHubs[corridor.originHubKey] &&
                resolvedHubs[corridor.destinationHubKey]
            );

            return (
              <div key={corridor.id} className="py-5 first:pt-4 last:pb-1">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1.5 max-w-3xl">
                    {/* Clean unboxed metadata kicker — zero pills */}
                    <div className="text-xs font-mono text-teal-800">
                      {corridor.routeCode} · {corridor.vehicleTypes} · Every{' '}
                      {corridor.headwayMinutes} min
                    </div>

                    <h3 className="text-base font-semibold text-slate-900">
                      {corridor.corridorTitle}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 font-mono tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {formatHm12(parseHm(corridor.firstTripTime))} –{' '}
                        {formatHm12(parseHm(corridor.lastTripTime))}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Travel: {corridor.typicalDurationMinutes}</span>
                      <span aria-hidden="true">·</span>
                      <span>{corridor.platformBay}</span>
                    </div>

                    <div className="text-xs text-slate-500">
                      Key Stops: {corridor.stopsAlongWay.join(' → ')}
                    </div>

                    <p className="text-xs text-slate-700 pt-0.5 leading-relaxed">
                      {corridor.touristAdvice}
                    </p>

                    <div
                      className={`text-xs font-medium pt-0.5 ${
                        liveStatus.isOperating ? 'text-teal-800' : 'text-slate-500'
                      }`}
                    >
                      <Bus className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
                      {liveStatus.statusLabel}
                    </div>
                  </div>

                  <div className="flex flex-row items-center justify-between gap-4 border-t border-slate-100 pt-3 lg:flex-col lg:items-end lg:border-t-0 lg:pt-0 shrink-0">
                    <div className="lg:text-right font-mono tabular-nums">
                      <div className="text-xs text-slate-500">Ordinary / Aircon</div>
                      <div className="text-lg font-bold text-slate-900">
                        ₱{corridor.typicalFarePhp} – ₱{corridor.airconFarePhp}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatConverted(corridor.typicalFarePhp)} –{' '}
                        {formatConverted(corridor.airconFarePhp)} ({selectedCurrency})
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onOpenCorridorOnMap(
                          corridor.originHubKey,
                          corridor.destinationHubKey
                        )
                      }
                      className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>{canJumpToMap ? 'View Route on Map' : 'Open Map'}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Interactive Offline Distance-to-Fare Estimator */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              02. Instant Tricycle &amp; Jeepney Distance Estimator
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Slide any trip distance in kilometers to check fair Bohol rates before
              negotiating curbside.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs font-mono tabular-nums text-slate-700">
            <SlidersHorizontal className="h-4 w-4 text-teal-700" />
            <span>
              {customKm} km · {customPax} {customPax === 1 ? 'rider' : 'riders'}
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-2">
                <span>Trip Distance</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-teal-800">
                  {customKm} km
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={65}
                step={1}
                value={customKm}
                onChange={(e) => setCustomKm(Number(e.target.value))}
                aria-label="Trip distance in kilometers"
                className="w-full accent-teal-700 h-2 cursor-pointer"
              />
              <div className="mt-1 flex justify-between text-[11px] font-mono text-slate-400">
                <span>1 km (Beach hop)</span>
                <span>20 km (Panglao–City)</span>
                <span>65 km (Hills)</span>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-700 mb-2">
                Group Size (Splits Private Pakyaw Tricycle)
              </div>
              <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                {[1, 2, 3, 4, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCustomPax(n)}
                    className={`min-h-[40px] min-w-[44px] rounded-lg px-3 py-1.5 font-mono text-xs font-semibold tabular-nums transition-colors ${
                      customPax === n
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {n}p
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 divide-y divide-slate-100">
            {customFareTable.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">
                    {item.modeName}
                  </div>
                  <div className="text-xs text-slate-500">
                    {item.localName} · Fair range ₱{item.rangeMinPhp}–₱
                    {item.rangeMaxPhp}
                  </div>
                </div>
                <div className="text-right font-mono tabular-nums shrink-0">
                  <div className="text-base font-bold text-slate-900">
                    ₱{item.totalPhp.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatConverted(item.totalPhp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
