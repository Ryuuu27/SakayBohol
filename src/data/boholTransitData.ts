import boholJeepneyImg from '../assets/images/bohol_jeepney_hills_1793071594835.jpg';
import panglaoTricycleImg from '../assets/images/panglao_tricycle_coast_1793071596180.jpg';
import lobocRiverImg from '../assets/images/loboc_river_corridor_1793071596285.jpg';
import {
  CebuanoPhrase,
  CurrencyOption,
  EmergencyContact,
  FareModeEstimate,
  HubQueryConfig,
  HubZone,
  JeepneyScheduleCorridor,
  PhraseCategory,
} from '../types/transit';

export const CORRIDOR_IMAGES = {
  interiorHills: boholJeepneyImg,
  panglaoCoast: panglaoTricycleImg,
  lobocValley: lobocRiverImg,
};

/**
 * Search queries resolved dynamically at runtime via Google Maps Places API (New)
 * Place.searchByText(). No coordinates, addresses, or ratings are hardcoded here.
 */
export const BOHOL_HUB_QUERIES: HubQueryConfig[] = [
  {
    hubKey: 'dao_terminal',
    label: 'Dao Integrated Bus Terminal',
    searchQuery: 'Dao Integrated Bus Terminal Tagbilaran City Bohol',
    zone: HubZone.TAGBILARAN,
    transitTip: 'Primary island bus & jeepney terminal next to Island City Mall (ICM).',
    isTerminal: true,
  },
  {
    hubKey: 'tagbilaran_seaport',
    label: 'Tagbilaran Tourist Seaport',
    searchQuery: 'Tagbilaran City Tourist Port Bohol',
    zone: HubZone.TAGBILARAN,
    transitTip: 'Fast-craft ferry arrival point from Cebu, Dumaguete, and Siquijor.',
    isTerminal: true,
  },
  {
    hubKey: 'panglao_airport',
    label: 'Bohol-Panglao Intl Airport',
    searchQuery: 'Bohol-Panglao International Airport Panglao',
    zone: HubZone.PANGLAO,
    transitTip: 'Southern Star air-conditioned airport bus stops directly outside arrivals.',
    isTerminal: true,
  },
  {
    hubKey: 'alona_beach',
    label: 'Alona Beach Junction',
    searchQuery: 'Alona Beach Panglao Bohol',
    zone: HubZone.PANGLAO,
    transitTip: 'Main Panglao beach hub for tricycles, island hopping, and Tagbilaran buses.',
  },
  {
    hubKey: 'hinagdanan_cave',
    label: 'Hinagdanan Cave (Dauis)',
    searchQuery: 'Hinagdanan Cave Dauis Panglao Bohol',
    zone: HubZone.PANGLAO,
    transitTip: 'Accessible via Dauis northern coastal jeepney or short Panglao tricycle hop.',
  },
  {
    hubKey: 'baclayon_church',
    label: 'Baclayon Heritage Church',
    searchQuery: 'Baclayon Church Bohol',
    zone: HubZone.INTERIOR,
    transitTip: 'First coastal stop east of Tagbilaran along the Loay-Loboc jeepney corridor.',
  },
  {
    hubKey: 'tarsier_corella',
    label: 'Philippine Tarsier Sanctuary',
    searchQuery: 'Philippine Tarsier Sanctuary Corella Bohol',
    zone: HubZone.INTERIOR,
    transitTip: 'Board the Sikatuna/Corella jeepney from Tagbilaran Cogon or Dao Terminal.',
  },
  {
    hubKey: 'loboc_river',
    label: 'Loboc River Cruise Plaza',
    searchQuery: 'Loboc Riverwatch Floating Resto Loboc Bohol',
    zone: HubZone.INTERIOR,
    transitTip: 'Alight at Loboc Public Plaza along the Carmen/Bilar interior bus route.',
  },
  {
    hubKey: 'chocolate_hills',
    label: 'Chocolate Hills Complex',
    searchQuery: 'Chocolate Hills Complex Carmen Bohol',
    zone: HubZone.INTERIOR,
    transitTip: 'Ask the Carmen-bound bus conductor to drop you at Chocolate Hills junction.',
  },
  {
    hubKey: 'anda_beach',
    label: 'Quinale Beach (Anda)',
    searchQuery: 'Quinale Beach Anda Bohol',
    zone: HubZone.EAST_COAST,
    transitTip: 'Served by eastbound Anda/Guindulman buses & vans from Dao Integrated Terminal.',
  },
];

/**
 * Calculates realistic Bohol tourist transit fares based on LTFRB Region VII
 * jeepney/bus distance tariffs and Tagbilaran/Panglao tricycle rates.
 */
export function calculateBoholFares(
  distanceMeters: number,
  passengers: number = 1,
  hasStatutoryDiscount: boolean = false
): FareModeEstimate[] {
  const km = Math.max(0.5, distanceMeters / 1000);
  const discountMultiplier = hasStatutoryDiscount ? 0.8 : 1;
  const pax = Math.max(1, Math.min(10, passengers));

  // 1. Traditional Jeepney / Multicab: ₱13 first 4km + ₱1.80/km after
  const extraJeepKm = Math.max(0, km - 4);
  const jeepPerPersonRaw = (13 + extraJeepKm * 1.8) * discountMultiplier;
  const jeepPerPerson = Math.max(11, Math.round(jeepPerPersonRaw));
  const jeepTotal = jeepPerPerson * pax;

  // 2. Modern Aircon Jeepney / Southern Star Bus: ₱15 first 4km + ₱2.20/km after
  const busPerPersonRaw = (15 + extraJeepKm * 2.2) * discountMultiplier;
  const busPerPerson = Math.max(12, Math.round(busPerPersonRaw));
  const busTotal = busPerPerson * pax;

  // 3. Shared Town Tricycle (Regular Ruta, within city/municipality <= 8km):
  // ₱15 first 2km + ₱2.50/km per passenger
  const extraTrikeKm = Math.max(0, km - 2);
  const sharedTrikePerPerson = Math.round((15 + extraTrikeKm * 2.5) * discountMultiplier);
  const sharedTrikeTotal = sharedTrikePerPerson * pax;

  // 4. Special Tourist Tricycle Charter ("Pakyaw" private hire, up to 3 passengers per trike):
  // Base ₱100 up to 3km + ₱24/km after (realistic Panglao / Tagbilaran negotiated charter)
  const trikesNeeded = Math.ceil(pax / 3);
  const singleCharterRaw = km <= 3 ? 100 : 100 + (km - 3) * 24;
  const charterBase = Math.round(singleCharterRaw / 10) * 10;
  const charterTotal = charterBase * trikesNeeded;
  const charterPerPerson = Math.round(charterTotal / pax);

  // 5. Habal-Habal (Solo Motorcycle Taxi, 1 rider per bike):
  // Base ₱50 first 2km + ₱16/km after
  const habalSingle = Math.round((50 + Math.max(0, km - 2) * 16) / 5) * 5;
  const habalTotal = habalSingle * pax;

  return [
    {
      id: 'modern_bus',
      modeName: 'Southern Star Bus / Modern Jeep',
      localName: 'Aircon Bus / Modern PUJ',
      totalPhp: busTotal,
      perPersonPhp: busPerPerson,
      rangeMinPhp: busTotal,
      rangeMaxPhp: Math.round(busTotal * 1.1),
      recommendedMaxKm: 120,
      isRecommended: km > 7,
      boardingNote:
        km > 15
          ? 'Best choice for highway corridors from Dao Terminal or Panglao Airport. Pay the conductor onboard and keep your paper ticket.'
          : 'Runs fixed highway corridors (Airport — Tagbilaran — Alona Beach, or Dao — Loboc — Carmen).',
    },
    {
      id: 'trad_jeepney',
      modeName: 'Traditional Jeepney / Multicab',
      localName: 'Jeep / Multicab',
      totalPhp: jeepTotal,
      perPersonPhp: jeepPerPerson,
      rangeMinPhp: jeepTotal,
      rangeMaxPhp: jeepTotal + 5 * pax,
      recommendedMaxKm: 45,
      isRecommended: km >= 3 && km <= 18,
      boardingNote:
        'Open-air local transit. Pass coins or ₱20/₱50 bills forward saying "Bayad palihog" and say "Lugar lang" to alight.',
    },
    {
      id: 'tricycle_charter',
      modeName: `Private Tricycle Charter (${trikesNeeded > 1 ? `${trikesNeeded} trikes` : 'Pakyaw'})`,
      localName: 'Pakyaw Tricycle (Door-to-Door)',
      totalPhp: charterTotal,
      perPersonPhp: charterPerPerson,
      rangeMinPhp: Math.max(80, Math.round((charterTotal * 0.85) / 10) * 10),
      rangeMaxPhp: Math.round((charterTotal * 1.2) / 10) * 10,
      recommendedMaxKm: 22,
      isRecommended: km < 7,
      boardingNote:
        km <= 22
          ? 'Agree on total "Pakyaw" vehicle price before boarding. Up to 3 adults + light daypacks fit per Boholano cabin tricycle.'
          : 'Long-distance tricycle charter (>22 km) is slow and costly; take a bus to the nearest town plaza then charter a local tricycle.',
    },
    {
      id: 'tricycle_shared',
      modeName: 'Shared Town Tricycle',
      localName: 'Regular Pasahero Tricycle',
      totalPhp: sharedTrikeTotal,
      perPersonPhp: sharedTrikePerPerson,
      rangeMinPhp: sharedTrikeTotal,
      rangeMaxPhp: sharedTrikeTotal + 10 * pax,
      recommendedMaxKm: 8,
      isRecommended: km <= 3.5,
      boardingNote:
        km <= 8
          ? 'Available inside Tagbilaran City proper & town centers along main streets. Wait for fellow riders heading the same way.'
          : 'Shared per-seat tricycles do not cross distant municipal boundaries; use Jeepney/Bus or Pakyaw charter instead.',
    },
    {
      id: 'habal_habal',
      modeName: 'Habal-Habal Motorbike Taxi',
      localName: 'Habal-Habal (Last-Mile Hill / Falls)',
      totalPhp: habalTotal,
      perPersonPhp: habalSingle,
      rangeMinPhp: Math.max(40, habalTotal - 15 * pax),
      rangeMaxPhp: habalTotal + 25 * pax,
      recommendedMaxKm: 18,
      isRecommended: false,
      boardingNote:
        'Ideal for solo travelers going from highway junctions up to Chocolate Hills viewpoint, Tarsier Sanctuary, or waterfalls.',
    },
  ];
}

export const BOHOL_JEEPNEY_SCHEDULES: JeepneyScheduleCorridor[] = [
  {
    id: 'airport_alona_tagbilaran',
    routeCode: 'PANGLAO LOOP',
    corridorTitle: 'Dao Terminal · Seaport · Panglao Airport · Alona Beach',
    originHubKey: 'dao_terminal',
    destinationHubKey: 'alona_beach',
    originTerminal: 'Dao Integrated Bus Terminal (Tagbilaran)',
    destinationStop: 'Panglao Intl Airport & Alona Beach',
    vehicleTypes: 'Southern Star Aircon Bus',
    firstTripTime: '05:45',
    lastTripTime: '19:30',
    headwayMinutes: 35,
    typicalDurationMinutes: '45–55 min',
    typicalFarePhp: 50,
    airconFarePhp: 70,
    platformBay: 'South Coastal Bay 1 (Airport Signboard)',
    stopsAlongWay: ['Tagbilaran Seaport Junction', 'Totolan Bridge', 'Dauis', 'Panglao Airport', 'Alona Beach'],
    touristAdvice: 'Airport-to-Alona Beach segment costs ₱50; Tagbilaran-to-Alona costs ₱70–₱80. Much cheaper than ₱500 airport taxi.',
  },
  {
    id: 'tagbilaran_chocolate_hills',
    routeCode: 'INTERIOR NORTH',
    corridorTitle: 'Dao Terminal · Loboc River · Bilar Forest · Chocolate Hills',
    originHubKey: 'dao_terminal',
    destinationHubKey: 'chocolate_hills',
    originTerminal: 'Dao Integrated Bus Terminal (Tagbilaran)',
    destinationStop: 'Chocolate Hills Complex (Carmen)',
    vehicleTypes: 'Southern Star Bus (Aircon & Ordinary)',
    firstTripTime: '04:30',
    lastTripTime: '18:00',
    headwayMinutes: 30,
    typicalDurationMinutes: '95–115 min',
    typicalFarePhp: 95,
    airconFarePhp: 120,
    platformBay: 'Interior Bay 3 ("Carmen / Talibon via Loay")',
    stopsAlongWay: ['Baclayon Church', 'Loay Junction', 'Loboc Plaza', 'Bilar Man-Made Forest', 'Carmen Hills'],
    touristAdvice: 'Board buses marked "Carmen" or "Talibon via Loay". Last return bus passing Chocolate Hills toward Tagbilaran is ~17:15.',
  },
  {
    id: 'tagbilaran_corella_tarsier',
    routeCode: 'CORELLA LINE',
    corridorTitle: 'Tagbilaran · Corella Tarsier Sanctuary · Sikatuna',
    originHubKey: 'dao_terminal',
    destinationHubKey: 'tarsier_corella',
    originTerminal: 'Dao Terminal / Cogon Market Jeepney Stop',
    destinationStop: 'Philippine Tarsier Sanctuary (Corella)',
    vehicleTypes: 'Traditional Jeepney & Multicab',
    firstTripTime: '06:00',
    lastTripTime: '17:30',
    headwayMinutes: 40,
    typicalDurationMinutes: '25–35 min',
    typicalFarePhp: 30,
    airconFarePhp: 40,
    platformBay: 'Jeepney Bay ("Sikatuna / Corella")',
    stopsAlongWay: ['Bool / Dampas Road', 'Corella Town Proper', 'Canapnapan Tarsier Gate'],
    touristAdvice: 'Tell the driver "Tarsier Sanctuary, Canapnapan". For return trips after 16:30, walk or take a ₱30 habal-habal to Corella Plaza.',
  },
  {
    id: 'tagbilaran_dauis_hinagdanan',
    routeCode: 'NORTH PANGLAO',
    corridorTitle: 'Tagbilaran · Dauis Church · Hinagdanan Cave · Momo Beach',
    originHubKey: 'tagbilaran_seaport',
    destinationHubKey: 'hinagdanan_cave',
    originTerminal: 'Tagbilaran City Square / Dao Terminal',
    destinationStop: 'Bingag & Hinagdanan Cave (Dauis)',
    vehicleTypes: 'Panglao Multicab & Jeepney',
    firstTripTime: '06:00',
    lastTripTime: '18:00',
    headwayMinutes: 25,
    typicalDurationMinutes: '25–30 min',
    typicalFarePhp: 28,
    airconFarePhp: 35,
    platformBay: 'Panglao North Multicab Queue',
    stopsAlongWay: ['Ambassador Causeway', 'Dauis Heritage Church', 'Bingag Junction', 'Hinagdanan Road'],
    touristAdvice: 'Alight at Bingag Hinagdanan signage; cave entrance is a 6-minute walk or ₱30 local tricycle hop.',
  },
  {
    id: 'tagbilaran_loboc_express',
    routeCode: 'LOBOC VALLEY',
    corridorTitle: 'Dao Terminal · Baclayon · Loay · Loboc River Plaza',
    originHubKey: 'dao_terminal',
    destinationHubKey: 'loboc_river',
    originTerminal: 'Dao Integrated Bus Terminal (Tagbilaran)',
    destinationStop: 'Loboc Public Plaza & Floating Resto',
    vehicleTypes: 'Loboc Jeepney & Southern Star Bus',
    firstTripTime: '05:30',
    lastTripTime: '18:30',
    headwayMinutes: 20,
    typicalDurationMinutes: '40–50 min',
    typicalFarePhp: 45,
    airconFarePhp: 55,
    platformBay: 'Jeepney Bay ("Loboc / Bilar")',
    stopsAlongWay: ['Bool Blood Compact', 'Baclayon Church', 'Alburquerque', 'Loay Bridge', 'Loboc River'],
    touristAdvice: 'Jeepneys terminate right beside the Loboc River cruise dock. Lunch cruises board between 11:00 and 13:30.',
  },
  {
    id: 'tagbilaran_anda_east',
    routeCode: 'EAST COAST',
    corridorTitle: 'Dao Terminal · Jagna Port · Guindulman · Anda Quinale Beach',
    originHubKey: 'dao_terminal',
    destinationHubKey: 'anda_beach',
    originTerminal: 'Dao Integrated Bus Terminal (Tagbilaran)',
    destinationStop: 'Anda Public Market & Quinale Beach',
    vehicleTypes: 'Southern Star Bus & UV Express Van',
    firstTripTime: '05:00',
    lastTripTime: '17:00',
    headwayMinutes: 45,
    typicalDurationMinutes: '135–160 min',
    typicalFarePhp: 155,
    airconFarePhp: 195,
    platformBay: 'East Coast Bay ("Anda / Ubay via Jagna")',
    stopsAlongWay: ['Garcia Hernandez', 'Jagna Ferry Port (Camiguin)', 'Duero', 'Guindulman', 'Anda Quinale'],
    touristAdvice: 'Direct "Anda" buses depart roughly hourly; otherwise ride any Ubay-via-Jagna bus to Guindulman and take a ₱40 tricycle into Anda.',
  },
];

export const CEBUANO_PHRASES: CebuanoPhrase[] = [
  {
    id: 'p_lugar',
    category: PhraseCategory.TRANSIT,
    english: 'Pull over / Stop right here, please.',
    cebuano: 'Lugar lang, palihog!',
    phonetic: 'loo-GAHR lahng, pah-lee-HOG',
    usageContext: 'Call this out clearly to stop a jeepney or multicab when approaching your drop-off.',
  },
  {
    id: 'p_bayad',
    category: PhraseCategory.TRANSIT,
    english: 'Here is my fare, please. (Passing money forward)',
    cebuano: 'Bayad palihog.',
    boholanoVariant: 'Bajad palihog.',
    phonetic: 'BAH-yahd (or BAH-jahd) pah-lee-HOG',
    usageContext: 'Say while handing coins or small bills to fellow jeepney passengers toward the driver.',
  },
  {
    id: 'p_plete',
    category: PhraseCategory.BARGAINING,
    english: 'How much is the fare going to [place]?',
    cebuano: 'Tagpila ang plete padulong sa...?',
    phonetic: 'tahg-pee-LAH ahng PLEH-teh pah-doo-LONG sah...',
    usageContext: 'Always ask before boarding a tricycle so both sides know whether it is regular or special charter.',
  },
  {
    id: 'p_pakyaw',
    category: PhraseCategory.BARGAINING,
    english: 'How much for the whole tricycle (private charter)?',
    cebuano: 'Tagpila kung pakyaw ang tibuok tricycle?',
    phonetic: 'tahg-pee-LAH koong pahk-YOW ahng tee-boo-OHK',
    usageContext: '"Pakyaw" means hiring the entire tricycle immediately without waiting for other passengers.',
  },
  {
    id: 'p_hangyo',
    category: PhraseCategory.BARGAINING,
    english: 'That is a bit steep — can we lower the price a little?',
    cebuano: 'Mahal ra gamay, pwede hangyo?',
    boholanoVariant: 'Mahal ra gamaj, pwede hangjo?',
    phonetic: 'mah-HAHL rah gah-MY, PWEH-deh HAHNG-yo',
    usageContext: 'Say with a warm smile when negotiating tourist tricycle charters in Panglao.',
  },
  {
    id: 'p_sukli',
    category: PhraseCategory.BARGAINING,
    english: 'May I have my change, please?',
    cebuano: 'Palihog ko sa sukli.',
    phonetic: 'pah-lee-HOG koh sah sook-LEE',
    usageContext: 'Useful if the conductor or driver gets busy after you pay with a ₱50 or ₱100 bill.',
  },
  {
    id: 'p_moagi',
    category: PhraseCategory.TRANSIT,
    english: 'Does this jeepney pass by [Chocolate Hills / Alona]?',
    cebuano: 'Moagi ba ni sa...?',
    phonetic: 'moh-AH-gee bah nee sah...',
    usageContext: 'Confirm with the driver or barker at Dao Terminal before climbing aboard.',
  },
  {
    id: 'p_bakante',
    category: PhraseCategory.TRANSIT,
    english: 'Is there still seats available for two?',
    cebuano: 'Naa pa bay bakante para sa duha?',
    phonetic: 'nah-AH pah bye bah-KAHN-teh PAH-rah sah doo-HAH',
    usageContext: 'Ask before squeezing into a multicab or shared tricycle.',
  },
  {
    id: 'p_terminal',
    category: PhraseCategory.DIRECTIONS,
    english: 'Where is the bus or jeepney terminal?',
    cebuano: 'Asa dapit ang terminal sa bus o jeep?',
    phonetic: 'AH-sah dah-PEET ahng tehr-mee-NAHL sah boos oh jeep',
    usageContext: 'Helpful in town plazas like Loboc, Carmen, or Jagna when heading back to Tagbilaran.',
  },
  {
    id: 'p_liko',
    category: PhraseCategory.DIRECTIONS,
    english: 'Turn left / Turn right / Straight ahead.',
    cebuano: 'Liko sa wala / Liko sa tuo / Diretso lang.',
    phonetic: 'lee-KOH sah wah-LAH / too-OH / dee-REHT-soh lahng',
    usageContext: 'Guide your tricycle driver along resort lanes in Panglao or Anda.',
  },
  {
    id: 'p_layo',
    category: PhraseCategory.DIRECTIONS,
    english: 'Is it still far from here?',
    cebuano: 'Layo pa ba gikan dinhi?',
    boholanoVariant: 'Lajo pa ba gikan dinhi?',
    phonetic: 'lah-YOH (or lah-JOH) pah bah GEE-kahn deen-HEE',
    usageContext: 'Check walking distance before deciding whether to walk or hail a tricycle.',
  },
  {
    id: 'p_buntag',
    category: PhraseCategory.COURTESY,
    english: 'Good morning! (Classic Boholano greeting)',
    cebuano: 'Maayong buntag!',
    boholanoVariant: 'Maajong buntag!',
    phonetic: 'mah-AH-yong (Bohol: mah-AH-jong) BOON-tahg',
    usageContext: 'Locals in Bohol love hearing "Maajong buntag" — Boholano pronounces intervocalic Y as a soft J.',
  },
  {
    id: 'p_hapon',
    category: PhraseCategory.COURTESY,
    english: 'Good afternoon / Good evening!',
    cebuano: 'Maayong hapon / Maayong gabii!',
    boholanoVariant: 'Maajong hapon / Maajong gabii!',
    phonetic: 'mah-AH-jong HAH-pon / gah-BEE-ee',
    usageContext: 'Use hapon from 12:00–18:00 and gabii after sunset.',
  },
  {
    id: 'p_salamat',
    category: PhraseCategory.COURTESY,
    english: 'Thank you very much!',
    cebuano: 'Daghang salamat!',
    phonetic: 'dahg-HAHNG sah-LAH-maht',
    usageContext: 'Warm thank-you when alighting from a tricycle, ferry, or eatery.',
  },
  {
    id: 'p_tabang',
    category: PhraseCategory.EMERGENCY,
    english: 'Please help me! Call an ambulance / police.',
    cebuano: 'Tabang palihog! Tawag ug ambulansya o pulis.',
    phonetic: 'TAH-bahng pah-lee-HOG! TAH-wahg oog ahm-boo-LAHN-syah',
    usageContext: 'Urgent phrase to alert bystanders or resort staff during an emergency.',
  },
  {
    id: 'p_tubig',
    category: PhraseCategory.EMERGENCY,
    english: 'Where can I buy drinking water / medicine?',
    cebuano: 'Asa ko makapalit ug tubig mainom o tambal?',
    phonetic: 'AH-sah koh mah-kah-pah-LEET oog TOO-beeg mah-ee-NOHM oh tahm-BAHL',
    usageContext: 'Handy during hot midday excursions in Carmen or Panglao.',
  },
];

export const BOHOL_EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    id: 'tarsier_117',
    agencyName: 'TaRSIER 117 — Bohol Emergency Rescue',
    roleDescription: 'Official Bohol Provincial Disaster, Medical Ambulance & Tourist Emergency Dispatch',
    areaCoverage: 'Province-wide (Tagbilaran, Panglao, Carmen, Loboc, Anda)',
    primaryPhone: '+63 917 510 1117',
    dialHref: 'tel:+639175101117',
    secondaryPhone: '(038) 411-0117',
    secondaryDialHref: 'tel:+63384110117',
    operatingHours: '24/7 Dispatch',
  },
  {
    id: 'national_911',
    agencyName: 'Philippines National Emergency Hotline',
    roleDescription: 'Police, Fire, and Medical Emergency Response',
    areaCoverage: 'Nationwide (All Mobile Networks)',
    primaryPhone: '911',
    dialHref: 'tel:911',
    operatingHours: '24/7 Toll-Free',
  },
  {
    id: 'panglao_tourist_police',
    agencyName: 'Panglao Tourist Police Assistance (TOPCOP)',
    roleDescription: 'Tourist safety, fare dispute mediation, and lost passport support',
    areaCoverage: 'Panglao Island, Alona Beach & Airport',
    primaryPhone: '+63 998 598 6416',
    dialHref: 'tel:+639985986416',
    operatingHours: '24/7 Duty Officer',
  },
  {
    id: 'tagbilaran_police',
    agencyName: 'Tagbilaran City Police Station',
    roleDescription: 'City law enforcement & terminal security assistance',
    areaCoverage: 'Tagbilaran City, Seaport & Dao Terminal',
    primaryPhone: '(038) 411-3232',
    dialHref: 'tel:+63384113232',
    secondaryPhone: '+63 998 598 6396',
    secondaryDialHref: 'tel:+639985986396',
    operatingHours: '24/7 Station Desk',
  },
  {
    id: 'gallares_hospital',
    agencyName: 'Gov. Celestino Gallares Memorial Medical Center',
    roleDescription: 'Tertiary regional referral hospital & emergency trauma center',
    areaCoverage: 'M. Parras St, Tagbilaran City',
    primaryPhone: '(038) 411-4868',
    dialHref: 'tel:+63384114868',
    operatingHours: '24/7 Emergency Room',
  },
  {
    id: 'coast_guard_bohol',
    agencyName: 'Philippine Coast Guard — Station Bohol',
    roleDescription: 'Maritime safety, Balicasag island-hopping & fast-craft ferry emergencies',
    areaCoverage: 'Tagbilaran Port, Panglao & Jagna Waters',
    primaryPhone: '+63 917 842 8446',
    dialHref: 'tel:+639178428446',
    operatingHours: '24/7 Maritime Watch',
  },
];

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  {code: 'USD', symbol: '$', name: 'US Dollar'},
  {code: 'EUR', symbol: '€', name: 'Euro'},
  {code: 'AUD', symbol: 'A$', name: 'Australian Dollar'},
  {code: 'KRW', symbol: '₩', name: 'South Korean Won'},
  {code: 'JPY', symbol: '¥', name: 'Japanese Yen'},
  {code: 'GBP', symbol: '£', name: 'British Pound'},
  {code: 'SGD', symbol: 'S$', name: 'Singapore Dollar'},
  {code: 'CAD', symbol: 'C$', name: 'Canadian Dollar'},
  {code: 'CNY', symbol: '¥', name: 'Chinese Yuan'},
];

/**
 * Baseline offline fallback rates (1 PHP -> Target Currency) used immediately
 * when offline or prior to live Frankfurter API sync.
 */
export const FALLBACK_PHP_RATES: Record<string, number> = {
  PHP: 1,
  USD: 0.0173,
  EUR: 0.016,
  AUD: 0.0265,
  KRW: 24.1,
  JPY: 2.66,
  GBP: 0.0135,
  SGD: 0.0233,
  CAD: 0.0241,
  CNY: 0.125,
};
