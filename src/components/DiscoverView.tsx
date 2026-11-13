import {
  CheckCircle2,
  Clock,
  LayoutGrid,
  Map as MapIcon,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { HERO_IMAGE, NEIGHBORHOODS, SERVICE_CATEGORIES } from '../data/pulseData';
import { ServiceCategory, ServicePro } from '../types/pulse';
import { NeighborhoodMap } from './NeighborhoodMap';
import { SafeImage } from './SafeImage';

interface DiscoverViewProps {
  pros: ServicePro[];
  onBookPro: (pro: ServicePro, initialTab?: 'book' | 'profile') => void;
  onSwitchToConsole: () => void;
  userDisplayName?: string | null;
  isSigningIn?: boolean;
  onSignInGoogle?: () => void;
  onSignOut?: () => void;
}

type SortOption = 'rating' | 'rate-asc' | 'response';

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  pros,
  onBookPro,
  onSwitchToConsole,
  userDisplayName,
  isSigningIn = false,
  onSignInGoogle,
  onSignOut,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('All Bay Area');
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>('All');
  const [onlyAvailableToday, setOnlyAvailableToday] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');

  const filteredPros = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = pros.filter((pro) => {
      if (selectedCategory !== 'All' && pro.category !== selectedCategory) return false;
      if (
        selectedNeighborhood !== 'All Bay Area' &&
        !pro.neighborhoods.includes(selectedNeighborhood)
      ) {
        return false;
      }
      if (onlyAvailableToday && !pro.availableToday) return false;

      if (q) {
        const haystack = [
          pro.name,
          pro.role,
          pro.category,
          pro.bio,
          ...pro.specialties,
          ...pro.neighborhoods,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'rate-asc') return a.hourlyRate - b.hourlyRate;
      return a.responseTimeMins - b.responseTimeMins;
    });
  }, [pros, searchQuery, selectedNeighborhood, selectedCategory, onlyAvailableToday, sortBy]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedNeighborhood('All Bay Area');
    setSelectedCategory('All');
    setOnlyAvailableToday(false);
    setSortBy('rating');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedNeighborhood !== 'All Bay Area' ||
    selectedCategory !== 'All' ||
    onlyAvailableToday;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-28 md:pb-14 space-y-10">
      {/* Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-between py-2 space-y-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#5308e7]">
              <span>Licensed &amp; Insured Specialists</span>
              <span aria-hidden="true" className="text-[#cac3d9]">·</span>
              <span className="text-[#484456]">San Francisco, Marin &amp; Peninsula</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-[-0.03em] leading-[1.12] text-[#1d192a] text-balance max-w-2xl">
              Vetted home care, dispatched on your schedule.
            </h1>

            <p className="text-base sm:text-lg text-[#484456] leading-relaxed max-w-xl">
              Book credentialed master electricians, estate detailers, climate engineers, and hydronics specialists with transparent hourly rates and live arrival windows.
            </p>
          </div>

          {/* Composite Search & Geo-Location Selector */}
          <div className="space-y-3">
            <div className="pulse-card rounded-2xl p-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0">
              <div className="flex-1 flex items-center gap-3 px-3 py-2">
                <Search className="w-5 h-5 text-[#6c3bff] shrink-0" aria-hidden="true" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Lutron lighting, travertine seal, heat pump..."
                  aria-label="Search services or specialist skills"
                  className="w-full bg-transparent text-sm font-medium text-[#1d192a] placeholder:text-[#6e6a82] focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search query"
                    className="p-1 rounded-lg text-[#6e6a82] hover:text-[#1d192a] hover:bg-[#ede7ff] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div
                aria-hidden="true"
                className="hidden sm:block w-px h-8 bg-[#6c3bff]/12 mx-1"
              />
              <div
                aria-hidden="true"
                className="sm:hidden h-px w-full bg-[#6c3bff]/10"
              />

              <div className="sm:w-64 flex items-center gap-2.5 px-3 py-2">
                <MapPin className="w-4 h-4 text-[#6c3bff] shrink-0" aria-hidden="true" />
                <select
                  value={selectedNeighborhood}
                  onChange={(e) => setSelectedNeighborhood(e.target.value)}
                  aria-label="Select neighborhood"
                  className="w-full bg-transparent text-sm font-semibold text-[#1d192a] focus:outline-none cursor-pointer"
                >
                  {NEIGHBORHOODS.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Secondary link into Pro Telemetry & Account Sync */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-4 text-xs text-[#6e6a82]">
                <span className="inline-flex items-center gap-1.5 font-medium text-[#005b3d]">
                  <ShieldCheck className="w-4 h-4 text-[#10b981]" />
                  $2M Property Protection Included
                </span>
                <span aria-hidden="true" className="text-[#cac3d9]">·</span>
                <span className="tabular-nums">Avg Dispatch ETA: 12 mins</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {userDisplayName ? (
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#1d192a]">
                    <span className="px-2.5 py-1 rounded-lg bg-[#ede7ff] text-[#5308e7]">
                      {userDisplayName}
                    </span>
                    <button
                      type="button"
                      onClick={onSignOut}
                      className="text-xs font-semibold text-[#6e6a82] hover:text-[#1d192a] cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onSignInGoogle}
                    disabled={isSigningIn}
                    className="h-8 px-3 rounded-lg bg-white border border-[#6c3bff]/20 text-xs font-semibold text-[#1d192a] hover:bg-[#f8f1ff] cursor-pointer whitespace-nowrap disabled:opacity-60"
                  >
                    {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onSwitchToConsole}
                  className="text-xs font-semibold text-[#5308e7] hover:text-[#6c3bff] underline underline-offset-4 cursor-pointer whitespace-nowrap"
                >
                  Open Pro Console
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Visual */}
        <div className="lg:col-span-5 relative min-h-[260px] lg:min-h-[340px]">
          <div className="relative h-full w-full rounded-2xl overflow-hidden border border-[#6c3bff]/10 shadow-[0_12px_32px_-4px_rgba(108,59,255,0.10)]">
            <SafeImage
              src={HERO_IMAGE}
              alt="Sunlit contemporary travertine and oak residence cared for by PulsePro specialists"
              className="w-full h-full object-cover"
              fallbackLabel="PulsePro Sanctuary"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#191526]/70 via-[#191526]/15 to-transparent"
            />
            <div className="absolute bottom-4 left-4 right-4 pulse-glass-white rounded-xl p-4 border border-[#6c3bff]/12 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#5308e7]">Same-Day Coverage</p>
                <p className="text-sm font-bold text-[#1d192a]">
                  4 of 5 Bay Area Specialists Open Today
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-[#6e6a82]">Network Rating</p>
                <p className="text-base font-bold text-[#1d192a] tabular-nums inline-flex items-center gap-1">
                  <Star className="w-4 h-4 fill-[#f59e0b] text-[#f59e0b]" />
                  4.97
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filter & Category Controls */}
      <section className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Interactive Category Filter Buttons */}
          <div
            role="tablist"
            aria-label="Service categories"
            className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar"
          >
            {SERVICE_CATEGORIES.map((category) => {
              const active = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCategory(category)}
                  className={`h-10 px-4 rounded-full text-sm font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c3bff] ${
                    active
                      ? 'bg-[#6c3bff] text-white shadow-sm shadow-[#6c3bff]/25'
                      : 'bg-[#ede7ff]/80 text-[#484456] hover:bg-[#e7dff7] hover:text-[#1d192a]'
                  }`}
                >
                  {category === 'All' ? 'All Services' : category}
                </button>
              );
            })}
          </div>

          {/* Availability Toggle + Sort + Grid/Map Switcher */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="inline-flex p-1 rounded-xl bg-[#ede4fd]">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === 'grid'
                    ? 'bg-white text-[#5308e7] shadow-sm'
                    : 'text-[#484456] hover:text-[#1d192a]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === 'map'
                    ? 'bg-white text-[#5308e7] shadow-sm'
                    : 'text-[#484456] hover:text-[#1d192a]'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                Map
              </button>
            </div>

            <button
              type="button"
              onClick={() => setOnlyAvailableToday((prev) => !prev)}
              aria-pressed={onlyAvailableToday}
              className={`h-10 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                onlyAvailableToday
                  ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#005b3d]'
                  : 'bg-white border-[#6c3bff]/12 text-[#484456] hover:border-[#6c3bff]/25'
              }`}
            >
              <CheckCircle2
                className={`w-4 h-4 ${onlyAvailableToday ? 'text-[#10b981]' : 'text-[#6e6a82]'}`}
              />
              Available Today
            </button>

            <div className="h-10 px-3 rounded-xl bg-white border border-[#6c3bff]/12 inline-flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#6e6a82]" aria-hidden="true" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort professionals"
                className="bg-transparent text-sm font-semibold text-[#1d192a] focus:outline-none cursor-pointer"
              >
                <option value="rating">Top Rated</option>
                <option value="rate-asc">Lowest Hourly Rate</option>
                <option value="response">Fastest Response</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between text-sm text-[#6e6a82]">
          <p className="tabular-nums">
            Showing <span className="font-semibold text-[#1d192a]">{filteredPros.length}</span> vetted{' '}
            {filteredPros.length === 1 ? 'specialist' : 'specialists'}
            {selectedNeighborhood !== 'All Bay Area' ? ` in ${selectedNeighborhood}` : ''}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-[#5308e7] hover:underline cursor-pointer"
            >
              Reset all filters
            </button>
          )}
        </div>

        {/* Service Cards Grid or Neighborhood Map */}
        {viewMode === 'map' ? (
          <NeighborhoodMap
            mode="providers"
            pros={filteredPros}
            selectedNeighborhood={selectedNeighborhood}
            onSelectNeighborhood={setSelectedNeighborhood}
            onBookPro={onBookPro}
          />
        ) : filteredPros.length === 0 ? (
          <div className="pulse-card rounded-2xl p-10 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#ede7ff] text-[#5308e7] flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h2 className="text-lg font-semibold text-[#1d192a]">
                No specialists match those filters
              </h2>
              <p className="text-sm text-[#6e6a82]">
                Try broadening your neighborhood selection or clearing the Same-Day availability filter.
              </p>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="h-11 px-5 rounded-xl bg-[#6c3bff] hover:bg-[#5308e7] text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredPros.map((pro) => (
              <article
                key={pro.id}
                className="pulse-card pulse-card-hover rounded-2xl p-6 flex flex-col justify-between gap-5"
              >
                <div className="space-y-4">
                  {/* Card Header: Portrait, Verification, Rate & Rating */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#6c3bff]/10 shrink-0 bg-[#f2eaff]">
                        <SafeImage
                          src={pro.avatarUrl}
                          alt={pro.name}
                          className="w-full h-full object-cover"
                          fallbackLabel={pro.name}
                        />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-lg font-bold tracking-[-0.01em] text-[#1d192a] truncate">
                          {pro.name}
                        </h2>
                        <p className="text-xs font-medium text-[#484456] truncate">
                          {pro.role}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-xs font-semibold ${
                              pro.availableToday
                                ? 'bg-[#10b981]/10 text-[#005b3d]'
                                : 'bg-[#ede7ff] text-[#484456]'
                            }`}
                          >
                            <CheckCircle2
                              className={`w-3.5 h-3.5 ${
                                pro.availableToday ? 'text-[#10b981]' : 'text-[#6c3bff]'
                              }`}
                            />
                            {pro.availableToday ? 'Available Today' : 'Verified Pro'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-[#1d192a] tabular-nums">
                        ${pro.hourlyRate}
                        <span className="text-xs font-medium text-[#6e6a82]">/hr</span>
                      </p>
                      <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f59e0b]/10 text-xs font-bold text-[#1d192a] tabular-nums">
                        <Star className="w-3.5 h-3.5 fill-[#f59e0b] text-[#f59e0b]" />
                        <span>{pro.rating.toFixed(2)}</span>
                        <span className="font-medium text-[#6e6a82]">({pro.reviewCount})</span>
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  <p className="text-sm text-[#484456] leading-relaxed line-clamp-2">
                    {pro.bio}
                  </p>

                  {/* Unboxed Typographic Metadata */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6e6a82] tabular-nums">
                    <span className="font-mono text-[11px] text-[#484456]">{pro.licenseId}</span>
                    <span aria-hidden="true">·</span>
                    <span>{pro.responseTimeMins} min avg response</span>
                    <span aria-hidden="true">·</span>
                    <span>{pro.completedJobs} jobs</span>
                  </div>

                  {/* Specialties list */}
                  <div className="pt-2 border-t border-[#6c3bff]/8">
                    <p className="text-xs font-semibold text-[#6e6a82] mb-1.5">Core Capabilities</p>
                    <p className="text-xs font-medium text-[#1d192a] leading-relaxed">
                      {pro.specialties.join(' · ')}
                    </p>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-[#6c3bff]/8 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#484456] min-w-0">
                    <Clock className="w-3.5 h-3.5 text-[#6c3bff] shrink-0" />
                    <span className="truncate">{pro.nextSlot}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onBookPro(pro, 'profile')}
                      className="h-10 px-3.5 rounded-xl bg-white border border-[#6c3bff]/18 text-[#5308e7] hover:bg-[#f8f1ff] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => onBookPro(pro, 'book')}
                      className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#6c3bff] hover:from-[#7c3aed] hover:to-[#5308e7] text-white text-xs font-semibold shadow-sm shadow-[#6c3bff]/20 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                    >
                      Book Pro
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
