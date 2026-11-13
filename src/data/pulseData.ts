import heroSanctuaryImg from '../assets/images/hero_home_sanctuary_1794550065763.jpg';
import claireImg from '../assets/images/pro_david_chen_1794550063771.jpg';
import elenaImg from '../assets/images/pro_elena_rostova_1794550064987.jpg';
import liamImg from '../assets/images/pro_liam_okafor_1794550065973.jpg';
import marcusImg from '../assets/images/pro_marcus_vance_1794550063322.jpg';
import sophiaImg from '../assets/images/pro_sophia_alvarez_1794550068048.jpg';
import {
  BookingRecord,
  DispatchJob,
  LatLngCoords,
  MapCoordinates,
  ServiceCategory,
  ServicePro,
  TelemetryPoint,
} from '../types/pulse';

export const HERO_IMAGE = heroSanctuaryImg;

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  'All',
  'Electrical',
  'Home Care',
  'Climate & HVAC',
  'Plumbing',
  'Landscaping',
];

export const NEIGHBORHOODS: string[] = [
  'All Bay Area',
  'Pacific Heights, SF',
  'Marina & Cow Hollow, SF',
  'Noe Valley, SF',
  'Mill Valley, Marin',
  'Rockridge, East Bay',
  'Palo Alto, Peninsula',
];

export const NEIGHBORHOOD_COORDS: Record<string, MapCoordinates> = {
  'Pacific Heights, SF': { x: 38, y: 44 },
  'Marina & Cow Hollow, SF': { x: 35, y: 36 },
  'Noe Valley, SF': { x: 41, y: 56 },
  'Mill Valley, Marin': { x: 26, y: 20 },
  'Rockridge, East Bay': { x: 69, y: 42 },
  'Palo Alto, Peninsula': { x: 64, y: 80 },
};

export const NEIGHBORHOOD_LAT_LNG: Record<string, LatLngCoords> = {
  'Pacific Heights, SF': { lat: 37.7925, lng: -122.4382 },
  'Marina & Cow Hollow, SF': { lat: 37.8015, lng: -122.4368 },
  'Noe Valley, SF': { lat: 37.7502, lng: -122.4337 },
  'Mill Valley, Marin': { lat: 37.906, lng: -122.5449 },
  'Rockridge, East Bay': { lat: 37.8442, lng: -122.2516 },
  'Palo Alto, Peninsula': { lat: 37.4419, lng: -122.143 },
};

export function getCoordsForNeighborhood(neighborhood: string, jitterSeed = 0): MapCoordinates {
  const base = NEIGHBORHOOD_COORDS[neighborhood] ?? { x: 42, y: 48 };
  const dx = ((jitterSeed % 5) - 2) * 1.4;
  const dy = (((jitterSeed * 3) % 5) - 2) * 1.2;
  return {
    x: Math.min(90, Math.max(10, base.x + dx)),
    y: Math.min(90, Math.max(10, base.y + dy)),
  };
}

export function getLatLngForNeighborhood(neighborhood: string, jitterSeed = 0): LatLngCoords {
  const base = NEIGHBORHOOD_LAT_LNG[neighborhood] ?? { lat: 37.7749, lng: -122.4194 };
  const dLat = ((jitterSeed % 5) - 2) * 0.0028;
  const dLng = (((jitterSeed * 3) % 5) - 2) * 0.0032;
  return {
    lat: Number((base.lat + dLat).toFixed(5)),
    lng: Number((base.lng + dLng).toFixed(5)),
  };
}

export const DATE_OPTIONS = [
  { id: 'today', day: 'Thu', date: '12', full: 'Today, Nov 12' },
  { id: 'fri', day: 'Fri', date: '13', full: 'Tomorrow, Nov 13' },
  { id: 'sat', day: 'Sat', date: '14', full: 'Sat, Nov 14' },
  { id: 'sun', day: 'Sun', date: '15', full: 'Sun, Nov 15' },
  { id: 'mon', day: 'Mon', date: '16', full: 'Mon, Nov 16' },
];

export const SERVICE_PROS: ServicePro[] = [
  {
    id: 'pro-marcus',
    name: 'Marcus Vance',
    role: 'Master Electrician & Smart Systems',
    category: 'Electrical',
    neighborhoods: ['Pacific Heights, SF', 'Marina & Cow Hollow, SF', 'Mill Valley, Marin'],
    hourlyRate: 145,
    rating: 4.98,
    reviewCount: 142,
    completedJobs: 418,
    responseTimeMins: 11,
    availableToday: true,
    nextSlot: 'Today, 2:00 PM',
    licenseId: 'CA-C10 #984210',
    bio: 'Architectural lighting designer and licensed master electrician specializing in Lutron HomeWorks, 200A panel upgrades, and Level 2 EV charging installations.',
    specialties: ['Lutron & Ketra Lighting', '200A Panel Upgrades', 'Level 2 EV Chargers', 'Whole-Home Surge'],
    avatarUrl: marcusImg,
    availableSlots: ['09:00 AM', '11:30 AM', '02:00 PM', '04:30 PM'],
    coords: { x: 37, y: 43 },
    latLng: { lat: 37.7931, lng: -122.4394 },
    reviews: [
      {
        id: 'rev-1',
        author: 'Catherine M.',
        neighborhood: 'Pacific Heights, SF',
        rating: 5.0,
        date: '3 days ago',
        comment: 'Installed two Rivian wall chargers and re-balanced our main subpanel with zero drywall damage. Spotless cleanup.',
      },
      {
        id: 'rev-2',
        author: 'Henrik S.',
        neighborhood: 'Mill Valley, Marin',
        rating: 4.9,
        date: '1 week ago',
        comment: 'Diagnosed a persistent dimmer flicker across 14 recessed fixtures in under twenty minutes.',
      },
    ],
  },
  {
    id: 'pro-elena',
    name: 'Elena Rostova',
    role: 'Estate Detailing & White-Glove Care',
    category: 'Home Care',
    neighborhoods: ['Pacific Heights, SF', 'Noe Valley, SF', 'Palo Alto, Peninsula'],
    hourlyRate: 95,
    rating: 4.99,
    reviewCount: 214,
    completedJobs: 690,
    responseTimeMins: 9,
    availableToday: true,
    nextSlot: 'Today, 1:30 PM',
    licenseId: 'PP-VET #44109',
    bio: 'Conservation-grade residential care for travertine, unlacquered brass, natural oak joinery, and museum-framed collections using pH-neutral botanical solutions.',
    specialties: ['Travertine & Marble Seal', 'Fine Wood & Linen Care', 'Post-Renovation Detail', 'Seasonal Reset'],
    avatarUrl: elenaImg,
    availableSlots: ['08:30 AM', '11:00 AM', '01:30 PM', '04:00 PM'],
    coords: { x: 42, y: 55 },
    latLng: { lat: 37.7524, lng: -122.4318 },
    reviews: [
      {
        id: 'rev-3',
        author: 'Julian K.',
        neighborhood: 'Pacific Heights, SF',
        rating: 5.0,
        date: '2 days ago',
        comment: 'The only specialist we trust with our honed limestone kitchen and custom white oak shelving.',
      },
    ],
  },
  {
    id: 'pro-claire',
    name: 'Claire Chen',
    role: 'Hydronic Climate & Heat Pump Engineer',
    category: 'Climate & HVAC',
    neighborhoods: ['Noe Valley, SF', 'Rockridge, East Bay', 'Palo Alto, Peninsula'],
    hourlyRate: 155,
    rating: 4.96,
    reviewCount: 98,
    completedJobs: 312,
    responseTimeMins: 14,
    availableToday: true,
    nextSlot: 'Today, 3:30 PM',
    licenseId: 'CA-C20 #812394',
    bio: 'NATE-certified HVAC systems engineer focused on variable-speed heat pumps, HEPA air purification, and quiet radiant floor balancing.',
    specialties: ['Heat Pump Diagnostics', 'MERV-16 & ERV Air', 'Radiant Zone Balancing', 'Smart Thermostat Calibration'],
    avatarUrl: claireImg,
    availableSlots: ['09:30 AM', '12:30 PM', '03:30 PM'],
    coords: { x: 67, y: 41 },
    latLng: { lat: 37.8435, lng: -122.2531 },
    reviews: [
      {
        id: 'rev-4',
        author: 'Nadia P.',
        neighborhood: 'Noe Valley, SF',
        rating: 5.0,
        date: '5 days ago',
        comment: 'Provided thermal airflow readouts for every bedroom and eliminated our upper-floor cold spot.',
      },
    ],
  },
  {
    id: 'pro-liam',
    name: 'Liam Jensen',
    role: 'Master Plumber & Copper Hydronics',
    category: 'Plumbing',
    neighborhoods: ['Marina & Cow Hollow, SF', 'Pacific Heights, SF', 'Rockridge, East Bay'],
    hourlyRate: 150,
    rating: 4.95,
    reviewCount: 163,
    completedJobs: 504,
    responseTimeMins: 12,
    availableToday: false,
    nextSlot: 'Tomorrow, 9:00 AM',
    licenseId: 'CA-C36 #773912',
    bio: 'Precision architectural plumbing for Dornbracht/Waterworks fixtures, tankless condensing water heaters, and smart whole-home leak shutoff valves.',
    specialties: ['Flo Smart Shutoff Valves', 'Tankless Descaling', 'Architectural Fixtures', 'Copper Repiping'],
    avatarUrl: liamImg,
    availableSlots: ['09:00 AM', '11:30 AM', '02:30 PM'],
    coords: { x: 34, y: 35 },
    latLng: { lat: 37.8012, lng: -122.4388 },
    reviews: [
      {
        id: 'rev-5',
        author: 'Devon R.',
        neighborhood: 'Marina & Cow Hollow, SF',
        rating: 4.9,
        date: '1 week ago',
        comment: 'Installed a smart ultrasonic shutoff valve and replaced two brass cartridges cleanly in one visit.',
      },
    ],
  },
  {
    id: 'pro-sophia',
    name: 'Sophia Alvarez',
    role: 'Architectural Courtyard & Irrigation Lead',
    category: 'Landscaping',
    neighborhoods: ['Mill Valley, Marin', 'Palo Alto, Peninsula', 'Rockridge, East Bay'],
    hourlyRate: 115,
    rating: 4.97,
    reviewCount: 127,
    completedJobs: 389,
    responseTimeMins: 18,
    availableToday: true,
    nextSlot: 'Today, 4:00 PM',
    licenseId: 'CA-C27 #660481',
    bio: 'Botanical care and smart Rachio drip-irrigation design for drought-tolerant architectural courtyards, Japanese maples, and limestone terraces.',
    specialties: ['Smart Drip Irrigation', 'Specimen Pruning', 'Low-Voltage Path Lighting', 'Seasonal Soil Health'],
    avatarUrl: sophiaImg,
    availableSlots: ['08:00 AM', '10:30 AM', '01:30 PM', '04:00 PM'],
    coords: { x: 25, y: 21 },
    latLng: { lat: 37.9052, lng: -122.5425 },
    reviews: [
      {
        id: 'rev-6',
        author: 'Maya L.',
        neighborhood: 'Mill Valley, Marin',
        rating: 5.0,
        date: '4 days ago',
        comment: 'Re-zoned our hillside drip lines and cut water usage by 34% while reviving our olive trees.',
      },
    ],
  },
];

export const INITIAL_BOOKINGS: BookingRecord[] = [
  {
    id: 'bk-101',
    referenceCode: 'PP-8492',
    proId: 'pro-marcus',
    proName: 'Marcus Vance',
    proRole: 'Master Electrician & Smart Systems',
    proAvatar: marcusImg,
    serviceSummary: 'Lutron Keypad Programming & Kitchen Dimmer Calibration',
    neighborhood: 'Pacific Heights, SF',
    address: '2418 Broadway, Apt 3B',
    dateLabel: 'Today, Nov 12',
    timeSlot: '02:00 PM',
    hours: 2,
    hourlyRate: 145,
    protectionFee: 18,
    totalAmount: 308,
    notes: 'Gate code #4821. Keypads are in the main salon and primary suite.',
    status: 'Confirmed',
    createdAt: '2026-11-12T09:15:00',
  },
  {
    id: 'bk-102',
    referenceCode: 'PP-8437',
    proId: 'pro-elena',
    proName: 'Elena Rostova',
    proRole: 'Estate Detailing & White-Glove Care',
    proAvatar: elenaImg,
    serviceSummary: 'Travertine Hearth Sealing & Whole-Floor Detail',
    neighborhood: 'Noe Valley, SF',
    address: '412 Sanchez St',
    dateLabel: 'Tomorrow, Nov 13',
    timeSlot: '11:00 AM',
    hours: 3,
    hourlyRate: 95,
    protectionFee: 18,
    totalAmount: 303,
    notes: 'Focus on living room stone hearth and unlacquered kitchen hardware.',
    status: 'En Route',
    createdAt: '2026-11-11T16:40:00',
  },
];

export const INITIAL_DISPATCH_JOBS: DispatchJob[] = [
  {
    id: 'dsp-401',
    referenceCode: 'PP-8504',
    clientName: 'Arthur Pendelton',
    neighborhood: 'Pacific Heights, SF',
    address: '2890 Jackson St',
    serviceTitle: 'Level 2 EV Wall Connector Load Check & Breaker Install',
    category: 'Electrical',
    scheduledDate: 'Today, Nov 12',
    scheduledWindow: '04:30 PM – 06:30 PM',
    durationHours: 2,
    payout: 290,
    priority: 'Priority',
    accessNotes: 'Garage alley entrance on Baker St. Subpanel is next to storage bay.',
    status: 'Pending',
    coords: { x: 36, y: 45 },
    latLng: { lat: 37.7918, lng: -122.4419 },
  },
  {
    id: 'dsp-402',
    referenceCode: 'PP-8509',
    clientName: 'Sora Takahashi',
    neighborhood: 'Marina & Cow Hollow, SF',
    address: '1945 Lyon St',
    serviceTitle: 'Ketra Linear Cove Troubleshooting & Driver Swap',
    category: 'Electrical',
    scheduledDate: 'Tomorrow, Nov 13',
    scheduledWindow: '09:00 AM – 12:00 PM',
    durationHours: 3,
    payout: 435,
    priority: 'Standard',
    accessNotes: 'Concierge holds spare key. Freight elevator reserved.',
    status: 'Pending',
    coords: { x: 33, y: 37 },
    latLng: { lat: 37.8001, lng: -122.4442 },
  },
  {
    id: 'dsp-403',
    referenceCode: 'PP-8492',
    clientName: 'Evelyn Mercer',
    neighborhood: 'Pacific Heights, SF',
    address: '2418 Broadway, Apt 3B',
    serviceTitle: 'Lutron Keypad Programming & Kitchen Dimmer Calibration',
    category: 'Electrical',
    scheduledDate: 'Today, Nov 12',
    scheduledWindow: '02:00 PM – 04:00 PM',
    durationHours: 2,
    payout: 290,
    priority: 'Standard',
    accessNotes: 'Gate code #4821. Keypads are in the main salon and primary suite.',
    status: 'Accepted',
    coords: { x: 40, y: 43 },
    latLng: { lat: 37.7942, lng: -122.4351 },
  },
  {
    id: 'dsp-404',
    referenceCode: 'PP-8481',
    clientName: 'Dr. Lucas Vance-Sterling',
    neighborhood: 'Mill Valley, Marin',
    address: '118 Throckmorton Ave',
    serviceTitle: 'Whole-Home Surge Arrestor & Span Smart Panel Audit',
    category: 'Electrical',
    scheduledDate: 'Today, Nov 12',
    scheduledWindow: '10:00 AM – 01:00 PM',
    durationHours: 3,
    payout: 435,
    priority: 'Standard',
    accessNotes: 'Driveway gate auto-opens on approach.',
    status: 'Completed',
    coords: { x: 27, y: 19 },
    latLng: { lat: 37.9064, lng: -122.5469 },
  },
];

export const WEEKLY_TELEMETRY: TelemetryPoint[] = [
  { label: 'Mon', earnings: 580, hours: 4.0, jobs: 2 },
  { label: 'Tue', earnings: 870, hours: 6.0, jobs: 3 },
  { label: 'Wed', earnings: 725, hours: 5.0, jobs: 2 },
  { label: 'Thu', earnings: 725, hours: 5.0, jobs: 2 },
  { label: 'Fri', earnings: 1015, hours: 7.0, jobs: 3 },
  { label: 'Sat', earnings: 635, hours: 4.5, jobs: 2 },
  { label: 'Sun', earnings: 290, hours: 2.0, jobs: 1 },
];

export const MONTHLY_TELEMETRY: TelemetryPoint[] = [
  { label: 'Wk 1', earnings: 4120, hours: 29.0, jobs: 11 },
  { label: 'Wk 2', earnings: 4580, hours: 32.5, jobs: 13 },
  { label: 'Wk 3', earnings: 4390, hours: 31.0, jobs: 12 },
  { label: 'Wk 4', earnings: 4840, hours: 33.5, jobs: 15 },
];
