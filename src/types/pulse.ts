export type ServiceCategory =
  | 'All'
  | 'Electrical'
  | 'Home Care'
  | 'Climate & HVAC'
  | 'Plumbing'
  | 'Landscaping';

export type AppView = 'discover' | 'bookings' | 'pro-console' | 'schedule' | 'game';

export type BookingStatus = 'Confirmed' | 'En Route' | 'On Site' | 'Completed' | 'Cancelled';

export type DispatchStatus = 'Pending' | 'Accepted' | 'En Route' | 'On Site' | 'Completed' | 'Declined';

export interface ProReview {
  id: string;
  author: string;
  neighborhood: string;
  rating: number;
  date: string;
  comment: string;
}

export interface MapCoordinates {
  x: number; // 0-100 percentage across fallback map canvas
  y: number; // 0-100 percentage down fallback map canvas
}

export interface LatLngCoords {
  lat: number;
  lng: number;
}

export interface ServicePro {
  id: string;
  name: string;
  role: string;
  category: Exclude<ServiceCategory, 'All'>;
  neighborhoods: string[];
  hourlyRate: number;
  rating: number;
  reviewCount: number;
  completedJobs: number;
  responseTimeMins: number;
  availableToday: boolean;
  nextSlot: string;
  licenseId: string;
  bio: string;
  specialties: string[];
  avatarUrl: string;
  availableSlots: string[];
  reviews: ProReview[];
  coords: MapCoordinates;
  latLng: LatLngCoords;
}

export interface BookingRecord {
  id: string;
  referenceCode: string;
  proId: string;
  proName: string;
  proRole: string;
  proAvatar: string;
  serviceSummary: string;
  neighborhood: string;
  address: string;
  dateLabel: string;
  timeSlot: string;
  hours: number;
  hourlyRate: number;
  protectionFee: number;
  totalAmount: number;
  notes: string;
  status: BookingStatus;
  createdAt: string;
}

export interface DispatchJob {
  id: string;
  referenceCode: string;
  clientName: string;
  neighborhood: string;
  address: string;
  serviceTitle: string;
  category: Exclude<ServiceCategory, 'All'>;
  scheduledDate: string;
  scheduledWindow: string;
  durationHours: number;
  payout: number;
  priority: 'Standard' | 'Priority';
  accessNotes: string;
  status: DispatchStatus;
  coords: MapCoordinates;
  latLng: LatLngCoords;
}

export interface TelemetryPoint {
  label: string;
  earnings: number;
  hours: number;
  jobs: number;
}

export interface GameScoreEntry {
  id: string | number;
  playerName: string;
  score: number;
  dispatchesCleared: number;
  durationSeconds: number;
  createdAt: string;
}
