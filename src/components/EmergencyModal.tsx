import React, {useState} from 'react';
import {Check, Copy, LocateFixed, PhoneCall, ShieldAlert, X} from 'lucide-react';
import {BOHOL_EMERGENCY_CONTACTS} from '../data/boholTransitData';
import {LiveUserLocation} from '../hooks/useGeolocation';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  userLocation: LiveUserLocation | null;
  onStartGps: () => void;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({
  isOpen,
  onClose,
  userLocation,
  onStartGps,
}) => {
  const [copiedCoords, setCopiedCoords] = useState(false);

  if (!isOpen) return null;

  const handleCopyLocation = async () => {
    if (!userLocation) return;
    const text = `Emergency GPS Position (Bohol): ${userLocation.lat.toFixed(
      5
    )}, ${userLocation.lng.toFixed(5)} (±${userLocation.accuracyMeters}m)`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCoords(true);
      setTimeout(() => setCopiedCoords(false), 2200);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />

        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Bohol Emergency &amp; Tourist Rescue
              </h2>
              <p className="text-xs text-slate-600">
                Tap any hotline below to dial immediately. Available offline 24/7.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close emergency contacts"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live GPS Coordinate Readout for Dispatch */}
        <div className="mt-4 rounded-2xl bg-slate-50 p-3.5 flex flex-wrap items-center justify-between gap-3">
          {userLocation ? (
            <>
              <div>
                <div className="text-xs text-slate-500">
                  Your Live GPS Coordinates (Read to TaRSIER 117)
                </div>
                <div className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                  {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)} · ±
                  {userLocation.accuracyMeters}m
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleCopyLocation()}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
              >
                {copiedCoords ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-teal-700" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy GPS</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <div className="text-xs text-slate-600">
                Share GPS coordinates to see your exact rescue position here.
              </div>
              <button
                type="button"
                onClick={onStartGps}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
              >
                <LocateFixed className="h-3.5 w-3.5" />
                <span>Get My GPS</span>
              </button>
            </>
          )}
        </div>

        {/* Direct Dial Emergency List */}
        <div className="mt-4 divide-y divide-slate-100">
          {BOHOL_EMERGENCY_CONTACTS.map((contact) => (
            <div
              key={contact.id}
              className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-slate-900">
                  {contact.agencyName}
                </div>
                <div className="text-xs text-slate-600">
                  {contact.roleDescription}
                </div>
                <div className="text-xs text-slate-500">
                  {contact.areaCoverage} · {contact.operatingHours}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {contact.secondaryPhone && contact.secondaryDialHref && (
                  <a
                    href={contact.secondaryDialHref}
                    className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs font-semibold tabular-nums text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <PhoneCall className="h-3.5 w-3.5 text-slate-500" />
                    <span>{contact.secondaryPhone}</span>
                  </a>
                )}

                <a
                  href={contact.dialHref}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 font-mono text-xs font-semibold tabular-nums text-white hover:bg-red-700 transition-colors whitespace-nowrap"
                >
                  <PhoneCall className="h-3.5 w-3.5" />
                  <span>{contact.primaryPhone}</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
