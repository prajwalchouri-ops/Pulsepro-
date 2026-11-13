import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  LocateFixed,
  MapPin,
  Minus,
  Navigation,
  Plus,
  Star,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { NEIGHBORHOOD_COORDS, NEIGHBORHOOD_LAT_LNG } from '../data/pulseData';
import { DispatchJob, DispatchStatus, ServicePro } from '../types/pulse';
import { SafeImage } from './SafeImage';

interface NeighborhoodMapProps {
  mode: 'providers' | 'dispatch';
  pros?: ServicePro[];
  dispatchJobs?: DispatchJob[];
  activePro?: ServicePro;
  selectedNeighborhood?: string;
  onSelectNeighborhood?: (neighborhood: string) => void;
  onBookPro?: (pro: ServicePro, initialTab?: 'book' | 'profile') => void;
  onUpdateDispatchStatus?: (id: string, status: DispatchStatus) => void;
}

const NEIGHBORHOOD_LABELS: { name: string; short: string; x: number; y: number }[] = [
  { name: 'Mill Valley, Marin', short: 'Mill Valley', x: 24, y: 16 },
  { name: 'Marina & Cow Hollow, SF', short: 'Marina · Cow Hollow', x: 34, y: 31 },
  { name: 'Pacific Heights, SF', short: 'Pacific Heights', x: 39, y: 42 },
  { name: 'Noe Valley, SF', short: 'Noe Valley', x: 41, y: 60 },
  { name: 'Rockridge, East Bay', short: 'Rockridge', x: 71, y: 38 },
  { name: 'Palo Alto, Peninsula', short: 'Palo Alto', x: 64, y: 83 },
];

const BAY_AREA_CENTER = { lat: 37.788, lng: -122.405 };

const MapCameraController: React.FC<{ selectedNeighborhood: string }> = ({
  selectedNeighborhood,
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (selectedNeighborhood === 'All Bay Area') {
      map.panTo(BAY_AREA_CENTER);
      map.setZoom(11);
      return;
    }
    const target = NEIGHBORHOOD_LAT_LNG[selectedNeighborhood];
    if (target) {
      map.panTo(target);
      map.setZoom(13);
    }
  }, [map, selectedNeighborhood]);

  return null;
};

export const NeighborhoodMap: React.FC<NeighborhoodMapProps> = ({
  mode,
  pros = [],
  dispatchJobs = [],
  activePro,
  selectedNeighborhood = 'All Bay Area',
  onSelectNeighborhood,
  onBookPro,
  onUpdateDispatchStatus,
}) => {
  const mapsApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ?? '';
  const [mapsLoadFailed, setMapsLoadFailed] = useState(false);

  const [selectedProId, setSelectedProId] = useState<string | null>(pros[0]?.id ?? null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    dispatchJobs.find((j) => j.status === 'Pending' || j.status === 'Accepted')?.id ??
      dispatchJobs[0]?.id ??
      null
  );
  const [infoWindowOpen, setInfoWindowOpen] = useState(false);

  // Fallback cartographic canvas controls
  const [zoom, setZoom] = useState<number>(1);
  const [focusCenter, setFocusCenter] = useState<{ x: number; y: number }>({
    x: 50,
    y: 50,
  });

  useEffect(() => {
    const onAuthFailure = () => setMapsLoadFailed(true);
    window.addEventListener('gmp-auth-failure', onAuthFailure);
    return () => window.removeEventListener('gmp-auth-failure', onAuthFailure);
  }, []);

  const selectedPro = useMemo(
    () => pros.find((p) => p.id === selectedProId) ?? pros[0] ?? null,
    [pros, selectedProId]
  );

  const visibleJobs = useMemo(
    () => dispatchJobs.filter((j) => j.status !== 'Declined'),
    [dispatchJobs]
  );

  const selectedJob = useMemo(
    () => visibleJobs.find((j) => j.id === selectedJobId) ?? visibleJobs[0] ?? null,
    [visibleJobs, selectedJobId]
  );

  const activeRoutePoints = useMemo(() => {
    if (mode !== 'dispatch' || !activePro) return [];
    const active = visibleJobs.filter(
      (j) => j.status === 'Accepted' || j.status === 'En Route' || j.status === 'On Site'
    );
    return [activePro.coords, ...active.map((j) => j.coords)];
  }, [mode, activePro, visibleJobs]);

  const handleFocusNeighborhood = (area: string) => {
    onSelectNeighborhood?.(area);
    if (area === 'All Bay Area') {
      setZoom(1);
      setFocusCenter({ x: 50, y: 50 });
      return;
    }
    const coords = NEIGHBORHOOD_COORDS[area];
    if (coords) {
      setZoom(1.45);
      setFocusCenter(coords);
    }
  };

  const handleZoomIn = () => setZoom((z) => Math.min(1.85, +(z + 0.25).toFixed(2)));
  const handleZoomOut = () => {
    setZoom((z) => {
      const next = Math.max(1, +(z - 0.25).toFixed(2));
      if (next === 1) setFocusCenter({ x: 50, y: 50 });
      return next;
    });
  };

  const transformStyle: React.CSSProperties = {
    transform: `scale(${zoom})`,
    transformOrigin: `${focusCenter.x}% ${focusCenter.y}%`,
    transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
  };

  const useLiveGoogleMaps = Boolean(mapsApiKey) && !mapsLoadFailed;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Interactive Cartographic Canvas */}
      <div className="lg:col-span-8 pulse-card rounded-2xl overflow-hidden flex flex-col">
        {/* Map Header Bar */}
        <div className="px-5 py-3.5 border-b border-[#6c3bff]/10 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#6c3bff]" />
            <h3 className="text-sm font-bold text-[#1d192a]">
              {mode === 'providers'
                ? 'Neighborhood Specialist Coverage'
                : 'Live Dispatch & Route Territory'}
            </h3>
            <span className="text-xs text-[#6e6a82] tabular-nums">
              ·{' '}
              {mode === 'providers'
                ? `${pros.length} pros visible`
                : `${visibleJobs.length} active stops`}
            </span>
          </div>

          {/* Quick Territory Focus Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { label: 'All Bay Area', value: 'All Bay Area' },
              { label: 'Pacific Heights', value: 'Pacific Heights, SF' },
              { label: 'Marina', value: 'Marina & Cow Hollow, SF' },
              { label: 'Noe Valley', value: 'Noe Valley, SF' },
              { label: 'Marin', value: 'Mill Valley, Marin' },
              { label: 'East Bay', value: 'Rockridge, East Bay' },
            ].map((chip) => {
              const isFocused = selectedNeighborhood === chip.value;
              return (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => handleFocusNeighborhood(chip.value)}
                  className={`h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    isFocused
                      ? 'bg-[#6c3bff] text-white'
                      : 'bg-[#f2eaff] text-[#484456] hover:bg-[#e7dff7]'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Map Viewport (CF2: explicit CSS height on Map container) */}
        <div className="relative h-[420px] sm:h-[470px] bg-[#ebe5ff] overflow-hidden select-none">
          {useLiveGoogleMaps ? (
            <APIProvider apiKey={mapsApiKey}>
              <div className="w-full h-full">
                <GoogleMap
                  mapId="DEMO_MAP_ID"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  defaultCenter={BAY_AREA_CENTER}
                  defaultZoom={11}
                  gestureHandling="greedy"
                  disableDefaultUI={false}
                  style={{ width: '100%', height: '100%' }}
                >
                  <MapCameraController selectedNeighborhood={selectedNeighborhood} />

                  {mode === 'providers' &&
                    pros.map((pro) => {
                      const isSelected = selectedPro?.id === pro.id;
                      return (
                        <AdvancedMarker
                          key={pro.id}
                          position={pro.latLng}
                          title={`${pro.name} — $${pro.hourlyRate}/hr`}
                          onClick={() => {
                            setSelectedProId(pro.id);
                            setInfoWindowOpen(true);
                          }}
                        >
                          <Pin
                            background={
                              isSelected
                                ? '#5308e7'
                                : pro.availableToday
                                  ? '#10b981'
                                  : '#6c3bff'
                            }
                            borderColor="#ffffff"
                            glyphColor="#ffffff"
                          />
                        </AdvancedMarker>
                      );
                    })}

                  {mode === 'providers' && selectedPro && infoWindowOpen && (
                    <InfoWindow
                      position={selectedPro.latLng}
                      onCloseClick={() => setInfoWindowOpen(false)}
                    >
                      <div className="p-1 space-y-1 max-w-[200px]">
                        <p className="text-xs font-bold text-[#1d192a]">{selectedPro.name}</p>
                        <p className="text-[11px] text-[#484456]">{selectedPro.role}</p>
                        <p className="text-[11px] font-semibold text-[#5308e7] tabular-nums">
                          ${selectedPro.hourlyRate}/hr · {selectedPro.nextSlot}
                        </p>
                      </div>
                    </InfoWindow>
                  )}

                  {mode === 'dispatch' && activePro && (
                    <AdvancedMarker position={activePro.latLng} title={`${activePro.name} Hub`}>
                      <Pin background="#1d192a" borderColor="#ffffff" glyphColor="#cbbeff" />
                    </AdvancedMarker>
                  )}

                  {mode === 'dispatch' &&
                    visibleJobs.map((job) => {
                      const isSelected = selectedJob?.id === job.id;
                      const isPriority = job.priority === 'Priority' && job.status === 'Pending';
                      const isCompleted = job.status === 'Completed';
                      return (
                        <AdvancedMarker
                          key={job.id}
                          position={job.latLng}
                          title={`${job.referenceCode} — $${job.payout}`}
                          onClick={() => {
                            setSelectedJobId(job.id);
                            setInfoWindowOpen(true);
                          }}
                        >
                          <Pin
                            background={
                              isSelected
                                ? '#5308e7'
                                : isPriority
                                  ? '#f59e0b'
                                  : isCompleted
                                    ? '#6e6a82'
                                    : '#10b981'
                            }
                            borderColor="#ffffff"
                            glyphColor="#ffffff"
                          />
                        </AdvancedMarker>
                      );
                    })}

                  {mode === 'dispatch' && selectedJob && infoWindowOpen && (
                    <InfoWindow
                      position={selectedJob.latLng}
                      onCloseClick={() => setInfoWindowOpen(false)}
                    >
                      <div className="p-1 space-y-1 max-w-[220px]">
                        <p className="text-xs font-bold text-[#1d192a]">
                          {selectedJob.referenceCode} · ${selectedJob.payout}
                        </p>
                        <p className="text-[11px] text-[#484456]">{selectedJob.serviceTitle}</p>
                        <p className="text-[11px] text-[#6e6a82]">
                          {selectedJob.address}, {selectedJob.neighborhood}
                        </p>
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>
              </div>
            </APIProvider>
          ) : (
            <>
              <div className="absolute inset-0" style={transformStyle}>
                {/* Interactive Bay Area Cartographic Fallback when Maps API key is not configured */}
                <svg
                  viewBox="0 0 1000 640"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="w-full h-full"
                >
                  <rect width="1000" height="640" fill="#EAE3FF" />
                  <path
                    d="M 0 0 L 410 0 C 395 70, 360 120, 340 165 C 310 195, 250 190, 210 175 C 165 155, 95 190, 0 210 Z"
                    fill="#FAF7FF"
                    stroke="#D9CEFA"
                    strokeWidth="2"
                  />
                  <path
                    d="M 180 235 C 250 225, 360 225, 425 245 C 460 265, 470 330, 480 410 C 510 475, 620 535, 740 580 L 760 640 L 0 640 L 0 290 C 65 265, 130 245, 180 235 Z"
                    fill="#FDFBFF"
                    stroke="#D9CEFA"
                    strokeWidth="2"
                  />
                  <path
                    d="M 590 0 L 1000 0 L 1000 640 L 840 640 C 770 550, 710 450, 645 365 C 605 305, 585 215, 600 120 C 605 70, 595 30, 590 0 Z"
                    fill="#FAF7FF"
                    stroke="#D9CEFA"
                    strokeWidth="2"
                  />
                  <rect x="235" y="238" width="85" height="36" rx="14" fill="#E4F5EE" />
                  <rect x="210" y="325" width="130" height="24" rx="10" fill="#E4F5EE" />
                  <circle cx="235" cy="115" r="34" fill="#E4F5EE" />
                  <circle cx="755" cy="215" r="42" fill="#E4F5EE" />
                  <path
                    d="M 275 182 Q 282 212 285 235"
                    stroke="#B9A6FA"
                    strokeWidth="4"
                    strokeDasharray="6 4"
                    fill="none"
                  />
                  <path
                    d="M 455 275 Q 535 265 625 248"
                    stroke="#B9A6FA"
                    strokeWidth="4"
                    strokeDasharray="6 4"
                    fill="none"
                  />
                  <g stroke="#EDE6FE" strokeWidth="2">
                    <line x1="210" y1="265" x2="450" y2="265" />
                    <line x1="190" y1="295" x2="460" y2="295" />
                    <line x1="205" y1="365" x2="468" y2="365" />
                    <line x1="240" y1="405" x2="475" y2="405" />
                    <line x1="290" y1="235" x2="290" y2="465" />
                    <line x1="350" y1="230" x2="350" y2="495" />
                    <line x1="405" y1="238" x2="405" y2="520" />
                    <path d="M 415 260 C 445 360, 495 465, 650 560" stroke="#DDD1FC" strokeWidth="3" fill="none" />
                    <path d="M 650 120 C 660 250, 705 385, 810 520" stroke="#DDD1FC" strokeWidth="3" fill="none" />
                  </g>

                  {mode === 'dispatch' && activeRoutePoints.length > 1 && (
                    <polyline
                      points={activeRoutePoints
                        .map((pt) => `${pt.x * 10},${pt.y * 6.4}`)
                        .join(' ')}
                      fill="none"
                      stroke="#6C3BFF"
                      strokeWidth="3.5"
                      strokeDasharray="8 6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.75"
                    />
                  )}
                </svg>

                {NEIGHBORHOOD_LABELS.map((area) => {
                  const isHighlighted = selectedNeighborhood === area.name;
                  return (
                    <div
                      key={area.name}
                      style={{ left: `${area.x}%`, top: `${area.y}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    >
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-[0.03em] uppercase whitespace-nowrap ${
                          isHighlighted
                            ? 'bg-[#6c3bff]/15 text-[#5308e7]'
                            : 'text-[#6e6a82]/85 bg-white/65'
                        }`}
                      >
                        {area.short}
                      </span>
                    </div>
                  );
                })}

                {mode === 'providers' &&
                  pros.map((pro) => {
                    const isSelected = selectedPro?.id === pro.id;
                    return (
                      <button
                        key={pro.id}
                        type="button"
                        onClick={() => setSelectedProId(pro.id)}
                        style={{ left: `${pro.coords.x}%`, top: `${pro.coords.y}%` }}
                        aria-label={`${pro.name}, $${pro.hourlyRate} per hour`}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer focus:outline-none transition-transform ${
                          isSelected ? 'z-20 scale-110' : 'z-10 hover:scale-105'
                        }`}
                      >
                        <div
                          className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border shadow-md transition-all ${
                            isSelected
                              ? 'bg-[#5308e7] border-white text-white shadow-[#5308e7]/35'
                              : 'bg-white border-[#6c3bff]/25 text-[#1d192a] hover:border-[#6c3bff]'
                          }`}
                        >
                          <div className="relative w-6 h-6 rounded-full overflow-hidden shrink-0 bg-[#ede4fd]">
                            <SafeImage
                              src={pro.avatarUrl}
                              alt={pro.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className="text-xs font-bold tabular-nums whitespace-nowrap">
                            ${pro.hourlyRate}
                          </span>
                          {pro.availableToday && (
                            <span
                              title="Available Today"
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isSelected ? 'bg-[#6ffbbe]' : 'bg-[#10b981]'
                              }`}
                            />
                          )}
                        </div>
                      </button>
                    );
                  })}

                {mode === 'dispatch' && activePro && (
                  <div
                    style={{ left: `${activePro.coords.x}%`, top: `${activePro.coords.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none"
                  >
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1d192a] text-white border-2 border-white shadow-md">
                      <LocateFixed className="w-3.5 h-3.5 text-[#cbbeff]" />
                      <span className="text-[11px] font-bold whitespace-nowrap">You (Hub)</span>
                    </div>
                  </div>
                )}

                {mode === 'dispatch' &&
                  visibleJobs.map((job) => {
                    const isSelected = selectedJob?.id === job.id;
                    const isPriority = job.priority === 'Priority' && job.status === 'Pending';
                    const isCompleted = job.status === 'Completed';

                    return (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => setSelectedJobId(job.id)}
                        style={{ left: `${job.coords.x}%`, top: `${job.coords.y}%` }}
                        aria-label={`${job.referenceCode} ${job.clientName}, $${job.payout}`}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer focus:outline-none transition-transform ${
                          isSelected ? 'z-20 scale-110' : 'z-10 hover:scale-105'
                        }`}
                      >
                        <div
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-md text-xs font-bold tabular-nums whitespace-nowrap ${
                            isSelected
                              ? 'bg-[#5308e7] border-white text-white shadow-[#5308e7]/35'
                              : isPriority
                                ? 'bg-[#fff8eb] border-[#f59e0b] text-[#9a5b00]'
                                : isCompleted
                                  ? 'bg-[#f2eaff] border-[#cac3d9] text-[#484456]'
                                  : 'bg-white border-[#10b981] text-[#005b3d]'
                          }`}
                        >
                          {isPriority ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
                          ) : isCompleted ? (
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <Navigation className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>${job.payout}</span>
                          <span className="font-mono text-[10px] opacity-80">
                            {job.referenceCode}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>

              {/* Floating Zoom Controls for Cartographic Fallback */}
              <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 pulse-glass-white p-1 rounded-xl border border-[#6c3bff]/14 shadow-sm">
                <button
                  type="button"
                  onClick={handleZoomIn}
                  aria-label="Zoom in map"
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[#1d192a] hover:bg-[#ede7ff] transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  aria-label="Zoom out map"
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[#1d192a] hover:bg-[#ede7ff] transition-colors cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleFocusNeighborhood('All Bay Area')}
                  aria-label="Reset map view"
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[#5308e7] hover:bg-[#ede7ff] transition-colors cursor-pointer"
                >
                  <LocateFixed className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {/* Map Legend */}
          <div className="absolute bottom-3 left-3 z-20 pulse-glass-white rounded-xl px-3.5 py-2 border border-[#6c3bff]/14 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-[#484456]">
            {mode === 'providers' ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                  Available Today
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#5308e7]" />
                  Selected Specialist
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b]" />
                  Priority Pending
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-[#10b981]" />
                  Active Route Stop
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#6e6a82]" />
                  Completed
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right Inspection Panel for Selected Pin */}
      <div className="lg:col-span-4 pulse-card rounded-2xl p-6 flex flex-col justify-between gap-5">
        {mode === 'providers' ? (
          selectedPro ? (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-semibold text-[#5308e7]">
                  <span>Selected Map Specialist</span>
                  <span className="text-[#6e6a82]">{selectedPro.category}</span>
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#6c3bff]/12 shrink-0 bg-[#ede4fd]">
                    <SafeImage
                      src={selectedPro.avatarUrl}
                      alt={selectedPro.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-lg font-bold text-[#1d192a] truncate">
                      {selectedPro.name}
                    </h4>
                    <p className="text-xs text-[#484456] truncate">{selectedPro.role}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#1d192a] tabular-nums">
                        <Star className="w-3.5 h-3.5 fill-[#f59e0b] text-[#f59e0b]" />
                        {selectedPro.rating.toFixed(2)} ({selectedPro.reviewCount})
                      </span>
                      <span aria-hidden="true" className="text-[#cac3d9]">·</span>
                      <span className="text-xs font-bold text-[#5308e7] tabular-nums">
                        ${selectedPro.hourlyRate}/hr
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-[#484456] leading-relaxed">{selectedPro.bio}</p>

                <div className="rounded-xl bg-[#f8f1ff] p-3.5 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#6e6a82]">Primary Coverage</span>
                    <span className="font-semibold text-[#1d192a]">
                      {selectedPro.neighborhoods[0]}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6e6a82]">Next Open Window</span>
                    <span className="font-semibold text-[#005b3d]">{selectedPro.nextSlot}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6e6a82]">Avg Dispatch ETA</span>
                    <span className="font-semibold text-[#1d192a] tabular-nums">
                      {selectedPro.responseTimeMins} mins
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6e6a82]">Coordinates</span>
                    <span className="font-mono text-[#484456] tabular-nums">
                      {selectedPro.latLng.lat.toFixed(4)}, {selectedPro.latLng.lng.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-2 border-t border-[#6c3bff]/8">
                <button
                  type="button"
                  onClick={() => onBookPro?.(selectedPro, 'profile')}
                  className="flex-1 h-11 rounded-xl bg-white border border-[#6c3bff]/18 text-[#5308e7] hover:bg-[#f8f1ff] text-xs font-semibold cursor-pointer"
                >
                  Inspect Profile
                </button>
                <button
                  type="button"
                  onClick={() => onBookPro?.(selectedPro, 'book')}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#6c3bff] hover:from-[#7c3aed] hover:to-[#5308e7] text-white text-xs font-semibold cursor-pointer"
                >
                  Book Pro
                </button>
              </div>
            </>
          ) : (
            <div className="my-auto text-center space-y-2 py-8">
              <MapPin className="w-7 h-7 text-[#6c3bff] mx-auto" />
              <p className="text-sm font-bold text-[#1d192a]">No specialists in filter</p>
              <p className="text-xs text-[#6e6a82]">
                Adjust your search or category filter to view specialist pins.
              </p>
            </div>
          )
        ) : selectedJob ? (
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-semibold text-[#6e6a82]">
                  {selectedJob.referenceCode}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-semibold ${
                    selectedJob.status === 'Pending'
                      ? 'bg-[#ede7ff] text-[#5308e7]'
                      : selectedJob.status === 'Completed'
                        ? 'bg-[#e7dff7] text-[#484456]'
                        : 'bg-[#10b981]/10 text-[#005b3d]'
                  }`}
                >
                  {selectedJob.status}
                </span>
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-bold text-[#1d192a]">{selectedJob.serviceTitle}</h4>
                <p className="text-xs font-semibold text-[#5308e7]">
                  Client: {selectedJob.clientName}
                </p>
              </div>

              <div className="rounded-xl bg-[#f8f1ff] p-4 space-y-2 text-xs">
                <div className="flex items-start gap-2 text-[#1d192a]">
                  <MapPin className="w-4 h-4 text-[#6c3bff] shrink-0 mt-0.5" />
                  <span className="font-semibold">
                    {selectedJob.address}, {selectedJob.neighborhood}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[#484456] tabular-nums">
                  <Clock className="w-4 h-4 text-[#6c3bff] shrink-0" />
                  <span>
                    {selectedJob.scheduledDate} · {selectedJob.scheduledWindow} (
                    {selectedJob.durationHours} hrs)
                  </span>
                </div>
                <p className="text-[#6e6a82] pt-1 border-t border-[#6c3bff]/10">
                  Access: {selectedJob.accessNotes}
                </p>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <span className="text-xs font-semibold text-[#6e6a82]">Estimated Payout</span>
                <span className="text-2xl font-extrabold text-[#1d192a] tabular-nums">
                  ${selectedJob.payout.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-[#6c3bff]/8">
              {selectedJob.status === 'Pending' && (
                <>
                  <button
                    type="button"
                    onClick={() => onUpdateDispatchStatus?.(selectedJob.id, 'Declined')}
                    className="h-11 px-4 rounded-xl bg-white border border-[#6c3bff]/18 text-[#6e6a82] hover:text-[#ba1a1a] text-xs font-semibold cursor-pointer"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateDispatchStatus?.(selectedJob.id, 'Accepted')}
                    className="flex-1 h-11 rounded-xl bg-[#6c3bff] hover:bg-[#5308e7] text-white text-xs font-semibold cursor-pointer"
                  >
                    Accept Dispatch
                  </button>
                </>
              )}
              {selectedJob.status === 'Accepted' && (
                <button
                  type="button"
                  onClick={() => onUpdateDispatchStatus?.(selectedJob.id, 'En Route')}
                  className="w-full h-11 rounded-xl bg-[#10b981] hover:bg-[#059669] text-white text-xs font-semibold cursor-pointer"
                >
                  Start Route
                </button>
              )}
              {selectedJob.status === 'En Route' && (
                <button
                  type="button"
                  onClick={() => onUpdateDispatchStatus?.(selectedJob.id, 'On Site')}
                  className="w-full h-11 rounded-xl bg-[#6c3bff] hover:bg-[#5308e7] text-white text-xs font-semibold cursor-pointer"
                >
                  Arrive On Site
                </button>
              )}
              {selectedJob.status === 'On Site' && (
                <button
                  type="button"
                  onClick={() => onUpdateDispatchStatus?.(selectedJob.id, 'Completed')}
                  className="w-full h-11 rounded-xl bg-[#005b3d] hover:bg-[#007650] text-white text-xs font-semibold cursor-pointer"
                >
                  Mark Complete
                </button>
              )}
              {selectedJob.status === 'Completed' && (
                <div className="w-full h-11 rounded-xl bg-[#10b981]/10 text-[#005b3d] text-xs font-semibold flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                  Completed &amp; Settled
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="my-auto text-center space-y-2 py-8">
            <MapPin className="w-7 h-7 text-[#6c3bff] mx-auto" />
            <p className="text-sm font-bold text-[#1d192a]">No active dispatches</p>
            <p className="text-xs text-[#6e6a82]">
              New homeowner requests will pin automatically to this map.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
