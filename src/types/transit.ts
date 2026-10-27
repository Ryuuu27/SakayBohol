export enum AppTab {
  MAP = 'MAP',
  SCHEDULES = 'SCHEDULES',
  PHRASES = 'PHRASES',
  CURRENCY = 'CURRENCY',
}

export enum HubZone {
  TAGBILARAN = 'Tagbilaran Hub',
  PANGLAO = 'Panglao Island',
  INTERIOR = 'Interior Karst',
  EAST_COAST = 'East Coast',
}

export interface HubQueryConfig {
  hubKey: string;
  label: string;
  searchQuery: string;
  zone: HubZone;
  transitTip: string;
  isTerminal?: boolean;
}

export interface ResolvedGooglePlace {
  placeId: string;
  hubKey?: string;
  displayName: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  rating?: number | null;
  cachedAt: number;
}

export interface RouteStepSummary {
  instruction: string;
  distanceMeters: number;
  maneuver?: string | null;
}

export interface SavedOfflineRoute {
  id: string;
  originName: string;
  originAddress: string;
  originLat: number;
  originLng: number;
  destinationName: string;
  destinationAddress: string;
  destinationLat: number;
  destinationLng: number;
  distanceMeters: number;
  durationMillis: number;
  steps: RouteStepSummary[];
  pathCoords: Array<{lat: number; lng: number}>;
  cachedAt: number;
}

export interface FareModeEstimate {
  id: string;
  modeName: string;
  localName: string;
  totalPhp: number;
  perPersonPhp: number;
  rangeMinPhp: number;
  rangeMaxPhp: number;
  recommendedMaxKm: number;
  isRecommended: boolean;
  boardingNote: string;
}

export interface JeepneyScheduleCorridor {
  id: string;
  routeCode: string;
  corridorTitle: string;
  originHubKey: string;
  destinationHubKey: string;
  originTerminal: string;
  destinationStop: string;
  vehicleTypes: string;
  firstTripTime: string; // HH:MM 24h in Asia/Manila
  lastTripTime: string;  // HH:MM 24h in Asia/Manila
  headwayMinutes: number;
  typicalDurationMinutes: string;
  typicalFarePhp: number;
  airconFarePhp: number;
  platformBay: string;
  stopsAlongWay: string[];
  touristAdvice: string;
}

export enum PhraseCategory {
  TRANSIT = 'Jeepney & Tricycle',
  BARGAINING = 'Fares & Money',
  DIRECTIONS = 'Directions',
  COURTESY = 'Greetings & Boholano',
  EMERGENCY = 'Safety & Dining',
}

export interface CebuanoPhrase {
  id: string;
  category: PhraseCategory;
  english: string;
  cebuano: string;
  boholanoVariant?: string;
  phonetic: string;
  usageContext: string;
}

export interface EmergencyContact {
  id: string;
  agencyName: string;
  roleDescription: string;
  areaCoverage: string;
  primaryPhone: string;
  dialHref: string;
  secondaryPhone?: string;
  secondaryDialHref?: string;
  operatingHours: string;
}

export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}
