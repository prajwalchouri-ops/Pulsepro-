import React from 'react';
import { AppView } from '../types/pulse';

interface TopNavProps {
  activeView: AppView;
  onSelectView: (view: AppView) => void;
  onPrimaryAction: () => void;
  bookingCount: number;
  pendingDispatchCount: number;
}

const NAV_ITEMS: { id: AppView; label: string }[] = [
  { id: 'discover', label: 'Discover' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'pro-console', label: 'Pro Console' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'game', label: '3D Dispatch' },
];

export const TopNav: React.FC<TopNavProps> = ({
  activeView,
  onSelectView,
  onPrimaryAction,
  bookingCount,
  pendingDispatchCount,
}) => {
  const isProMode = activeView === 'pro-console' || activeView === 'schedule';

  return (
    <header className="sticky top-0 z-40 pulse-glass border-b border-[#6c3bff]/10">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectView('discover')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c3bff] rounded-lg"
        >
          <span
            aria-hidden="true"
            className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#5308e7] flex items-center justify-center shadow-sm shadow-[#6c3bff]/25"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 13h4l2.5-6 3.5 10 2.5-4H20"
                stroke="#ffffff"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-xl font-extrabold tracking-[-0.03em] text-[#1d192a]">
            Pulse<span className="text-[#6c3bff]">Pro</span>
          </span>
        </button>

        {/* Zone 2: 4 Clean Single-Line Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            const count =
              item.id === 'bookings'
                ? bookingCount
                : item.id === 'pro-console'
                  ? pendingDispatchCount
                  : 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                className={`relative py-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c3bff] rounded-md ${
                  isActive
                    ? 'text-[#5308e7]'
                    : 'text-[#6e6a82] hover:text-[#1d192a]'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {item.label}
                  {count > 0 && (
                    <span className="text-[11px] font-mono tabular-nums text-[#6c3bff]">
                      ({count})
                    </span>
                  )}
                </span>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[1px] h-[2px] rounded-full bg-[#6c3bff]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#6c3bff] hover:from-[#7c3aed] hover:to-[#5308e7] text-white text-sm font-semibold whitespace-nowrap shrink-0 shadow-sm shadow-[#6c3bff]/25 active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c3bff] focus-visible:ring-offset-2"
          >
            {isProMode ? 'Book as Client' : 'Book a Pro'}
          </button>
        </div>
      </div>
    </header>
  );
};
