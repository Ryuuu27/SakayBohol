import {useCallback, useEffect, useRef, useState} from 'react';

export interface LiveUserLocation {
  lat: number;
  lng: number;
  accuracyMeters: number;
  speedKmh: number | null;
  heading: number | null;
  updatedAt: number;
}

export function computeHaversineMeters(
  a: {lat: number; lng: number},
  b: {lat: number; lng: number}
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Provides explicit, revocable user-consented real-time GPS tracking.
 */
export function useGeolocation() {
  const [isTracking, setIsTracking] = useState(false);
  const [userLocation, setUserLocation] = useState<LiveUserLocation | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const startTracking = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeoError('GPS location is not supported on this device/browser.');
      return;
    }
    setGeoError(null);
    setIsTracking(true);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyMeters: Math.round(pos.coords.accuracy),
          speedKmh:
            pos.coords.speed !== null && !Number.isNaN(pos.coords.speed)
              ? Math.max(0, Math.round(pos.coords.speed * 3.6))
              : null,
          heading: pos.coords.heading,
          updatedAt: pos.timestamp || Date.now(),
        });
        setGeoError(null);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Location permission was declined. Enable GPS access in browser settings to track live position.');
        } else if (err.code === err.TIMEOUT) {
          setGeoError('GPS signal timed out. Move toward open sky or check device location services.');
        } else {
          setGeoError('Unable to read live GPS coordinates right now.');
        }
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 8000,
        timeout: 15000,
      }
    );
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    isTracking,
    userLocation,
    geoError,
    startTracking,
    stopTracking,
  };
}
