import { Activity, CalendarDays, ClipboardList, Compass, Gamepad2 } from 'lucide-react';
import React from 'react';
import { AppView } from '../types/pulse';

interface MobileBottomBarProps {
  activeView: AppView;
  onSelectView: (view: AppView) => void;
  bookingCount: number;
  pendingDispatchCount: number;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  activeView,
  onSelectView,
  bookingCount,
  pendingDispatchCount,
}) => {
  const tabs: { id: AppView; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'discover', label: 'Discover', icon: <Compass className="w-5 h-5" /> },
    {
      id: 'bookings',
      label: 'Bookings',
      icon: <ClipboardList className="w-5 h-5" />,
      badge: bookingCount,
    },
    {
      id: 'pro-console',
      label: 'Console',
      icon: <Activity className="w-5 h-5" />,
      badge: pendingDispatchCount,
    },
    { id: 'schedule', label: 'Schedule', icon: <CalendarDays className="w-5 h-5" /> },
    { id: 'game', label: '3D Run', icon: <Gamepad2 className="w-5 h-5" /> },
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-4 inset-x-4 z-40 pulse-glass-white pulse-floating rounded-2xl border border-[#6c3bff]/12 px-2 h-14 flex items-center justify-around"
    >
      {tabs.map((tab) => {
        const isActive = activeView === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectView(tab.id)}
            className={`relative min-w-[56px] min-h-[44px] px-2 flex flex-col items-center justify-center rounded-xl transition-colors ${
              isActive
                ? 'text-[#5308e7] bg-[#ede7ff]/70'
                : 'text-[#6e6a82] hover:text-[#1d192a]'
            }`}
          >
            <span className="relative">
              {tab.icon}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#6c3bff] text-white text-[10px] font-bold leading-4 text-center tabular-nums">
                  {tab.badge}
                </span>
              )}
            </span>
            <span className="text-[10px] font-semibold tracking-[0.02em] mt-0.5 whitespace-nowrap">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
