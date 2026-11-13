/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookingDrawer } from './components/BookingDrawer';
import { BookingsView } from './components/BookingsView';
import { DiscoverView } from './components/DiscoverView';
import { DispatchGame3D } from './components/DispatchGame3D';
import { MobileBottomBar } from './components/MobileBottomBar';
import { ProConsoleView } from './components/ProConsoleView';
import { ProScheduleView } from './components/ProScheduleView';
import { TopNav } from './components/TopNav';
import { useAuth } from './context/AuthContext';
import {
  getCoordsForNeighborhood,
  getLatLngForNeighborhood,
  INITIAL_BOOKINGS,
  INITIAL_DISPATCH_JOBS,
  SERVICE_PROS,
} from './data/pulseData';
import {
  AppView,
  BookingRecord,
  BookingStatus,
  DispatchJob,
  DispatchStatus,
  GameScoreEntry,
  ServiceCategory,
  ServicePro,
} from './types/pulse';

function mapDispatchToBookingStatus(status: DispatchStatus): BookingStatus | null {
  if (status === 'Accepted') return 'Confirmed';
  if (status === 'En Route') return 'En Route';
  if (status === 'On Site') return 'On Site';
  if (status === 'Completed') return 'Completed';
  if (status === 'Declined') return 'Cancelled';
  return null;
}

function mapBookingToDispatchStatus(status: BookingStatus): DispatchStatus | null {
  if (status === 'Confirmed') return 'Accepted';
  if (status === 'En Route') return 'En Route';
  if (status === 'On Site') return 'On Site';
  if (status === 'Completed') return 'Completed';
  if (status === 'Cancelled') return 'Declined';
  return null;
}

interface SqlBookingRow {
  id: number;
  referenceCode: string;
  proId: string;
  proName: string;
  proRole: string;
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
  status: string;
  createdAt?: string | null;
}

interface SqlDispatchRow {
  id: number;
  referenceCode: string;
  clientName: string;
  neighborhood: string;
  address: string;
  serviceTitle: string;
  category: string;
  scheduledDate: string;
  scheduledWindow: string;
  durationHours: number;
  payout: number;
  priority: string;
  accessNotes: string;
  status: string;
  lat: string;
  lng: string;
}

interface SqlScoreRow {
  id: number;
  score: number;
  dispatchesCleared: number;
  durationSeconds: number;
  createdAt?: string | null;
}

export default function App() {
  const {
    user,
    authReady,
    signingIn,
    firestoreBookings,
    firestoreScores,
    signInWithGoogle,
    signOutUser,
    getFreshToken,
    saveBookingToFirestore,
    updateBookingStatusInFirestore,
    updateBookingSlotInFirestore,
    saveScoreToFirestore,
  } = useAuth();

  const [activeView, setActiveView] = useState<AppView>('discover');
  const [bookings, setBookings] = useState<BookingRecord[]>(INITIAL_BOOKINGS);
  const [dispatchJobs, setDispatchJobs] = useState<DispatchJob[]>(INITIAL_DISPATCH_JOBS);
  const [sqlScores, setSqlScores] = useState<GameScoreEntry[]>([]);
  const [isAcceptingDispatches, setIsAcceptingDispatches] = useState(true);

  const [drawerPro, setDrawerPro] = useState<ServicePro | null>(null);
  const [drawerTab, setDrawerTab] = useState<'book' | 'profile'>('book');

  // Hydrate persisted Cloud SQL workspace when authenticated
  useEffect(() => {
    if (!authReady || !user) {
      setBookings(INITIAL_BOOKINGS);
      setDispatchJobs(INITIAL_DISPATCH_JOBS);
      setSqlScores([]);
      return;
    }

    let cancelled = false;
    const loadWorkspace = async () => {
      try {
        const token = await getFreshToken();
        if (!token || cancelled) return;

        const res = await fetch('/api/bootstrap', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;

        const data = (await res.json()) as {
          bookings?: SqlBookingRow[];
          dispatches?: SqlDispatchRow[];
          topScores?: SqlScoreRow[];
        };

        if (cancelled) return;

        if (Array.isArray(data.bookings) && data.bookings.length > 0) {
          const hydratedBookings: BookingRecord[] = data.bookings.map((row) => {
            const pro = SERVICE_PROS.find((p) => p.id === row.proId);
            return {
              id: `sql-bk-${row.id}`,
              referenceCode: row.referenceCode,
              proId: row.proId,
              proName: row.proName,
              proRole: row.proRole,
              proAvatar: pro?.avatarUrl ?? SERVICE_PROS[0].avatarUrl,
              serviceSummary: row.serviceSummary,
              neighborhood: row.neighborhood,
              address: row.address,
              dateLabel: row.dateLabel,
              timeSlot: row.timeSlot,
              hours: row.hours,
              hourlyRate: row.hourlyRate,
              protectionFee: row.protectionFee,
              totalAmount: row.totalAmount,
              notes: row.notes,
              status: (row.status as BookingStatus) ?? 'Confirmed',
              createdAt: row.createdAt ?? new Date().toISOString(),
            };
          });
          setBookings((prev) => {
            const seen = new Set(hydratedBookings.map((b) => b.referenceCode));
            const defaults = prev.filter((b) => !seen.has(b.referenceCode));
            return [...hydratedBookings, ...defaults];
          });
        }

        if (Array.isArray(data.dispatches) && data.dispatches.length > 0) {
          const hydratedDispatches: DispatchJob[] = data.dispatches.map((row, idx) => ({
            id: `sql-dsp-${row.id}`,
            referenceCode: row.referenceCode,
            clientName: row.clientName,
            neighborhood: row.neighborhood,
            address: row.address,
            serviceTitle: row.serviceTitle,
            category: (row.category as Exclude<ServiceCategory, 'All'>) ?? 'Home Care',
            scheduledDate: row.scheduledDate,
            scheduledWindow: row.scheduledWindow,
            durationHours: row.durationHours,
            payout: row.payout,
            priority: row.priority === 'Priority' ? 'Priority' : 'Standard',
            accessNotes: row.accessNotes,
            status: (row.status as DispatchStatus) ?? 'Pending',
            coords: getCoordsForNeighborhood(row.neighborhood, idx + 1),
            latLng: {
              lat: Number(row.lat) || getLatLngForNeighborhood(row.neighborhood, idx + 1).lat,
              lng: Number(row.lng) || getLatLngForNeighborhood(row.neighborhood, idx + 1).lng,
            },
          }));
          setDispatchJobs((prev) => {
            const seen = new Set(hydratedDispatches.map((d) => d.referenceCode));
            const defaults = prev.filter((d) => !seen.has(d.referenceCode));
            return [...hydratedDispatches, ...defaults];
          });
        }

        if (Array.isArray(data.topScores)) {
          setSqlScores(
            data.topScores.map((s) => ({
              id: `sql-sc-${s.id}`,
              playerName: user.displayName || 'PulsePro Driver',
              score: s.score,
              dispatchesCleared: s.dispatchesCleared,
              durationSeconds: s.durationSeconds,
              createdAt: s.createdAt ?? new Date().toISOString(),
            }))
          );
        }
      } catch (err) {
        console.error('Workspace sync skipped:', err);
      }
    };

    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [authReady, user, getFreshToken]);

  // Merge Firestore real-time bookings seamlessly when signed in
  useEffect(() => {
    if (!user || firestoreBookings.length === 0) return;
    setBookings((prev) => {
      const merged = new Map<string, BookingRecord>();
      for (const b of prev) merged.set(b.referenceCode, b);
      for (const fb of firestoreBookings) merged.set(fb.referenceCode, fb);
      return Array.from(merged.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    });
  }, [user, firestoreBookings]);

  const combinedTopScores = useMemo(() => {
    const all = [...sqlScores, ...firestoreScores];
    const dedup = new Map<string, GameScoreEntry>();
    for (const s of all) {
      const key = `${s.score}-${s.dispatchesCleared}-${s.durationSeconds}`;
      if (!dedup.has(key)) dedup.set(key, s);
    }
    return Array.from(dedup.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [sqlScores, firestoreScores]);

  const activeBookingsCount = bookings.filter(
    (b) => b.status === 'Confirmed' || b.status === 'En Route' || b.status === 'On Site'
  ).length;

  const pendingDispatchCount = dispatchJobs.filter((j) => j.status === 'Pending').length;

  const handleOpenProDrawer = (pro: ServicePro, initialTab: 'book' | 'profile' = 'book') => {
    setDrawerPro(pro);
    setDrawerTab(initialTab);
  };

  const handleTopPrimaryAction = () => {
    if (activeView === 'pro-console' || activeView === 'schedule') {
      setActiveView('discover');
      return;
    }
    const defaultPro = SERVICE_PROS.find((p) => p.availableToday) ?? SERVICE_PROS[0];
    handleOpenProDrawer(defaultPro, 'book');
  };

  const handleConfirmBooking = (
    payload: Omit<BookingRecord, 'id' | 'referenceCode' | 'createdAt' | 'status'>
  ): BookingRecord => {
    const refNumber = 8510 + bookings.length;
    const referenceCode = `PP-${refNumber}`;

    const newBooking: BookingRecord = {
      ...payload,
      id: `bk-${Date.now()}`,
      referenceCode,
      status: 'Confirmed',
      createdAt: new Date().toISOString(),
    };

    const proMeta = SERVICE_PROS.find((p) => p.id === payload.proId);
    const latLng = getLatLngForNeighborhood(payload.neighborhood, bookings.length + 1);

    const newDispatch: DispatchJob = {
      id: `dsp-${Date.now()}`,
      referenceCode,
      clientName: user?.displayName || 'Homeowner Residence',
      neighborhood: payload.neighborhood,
      address: payload.address,
      serviceTitle: payload.serviceSummary,
      category: proMeta?.category ?? 'Home Care',
      scheduledDate: payload.dateLabel,
      scheduledWindow: payload.timeSlot,
      durationHours: payload.hours,
      payout: payload.hourlyRate * payload.hours,
      priority: 'Priority',
      accessNotes: payload.notes,
      status: 'Pending',
      coords: getCoordsForNeighborhood(payload.neighborhood, bookings.length + 1),
      latLng,
    };

    setBookings((prev) => [newBooking, ...prev]);
    setDispatchJobs((prev) => [newDispatch, ...prev]);

    if (user) {
      void saveBookingToFirestore(newBooking);
      void (async () => {
        const token = await getFreshToken();
        if (!token) return;
        await fetch('/api/bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...newBooking,
            category: proMeta?.category ?? 'Home Care',
            lat: String(latLng.lat),
            lng: String(latLng.lng),
          }),
        });
      })();
    }

    return newBooking;
  };

  const handleCancelBooking = (id: string) => {
    const target = bookings.find((b) => b.id === id);
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: 'Cancelled' } : b))
    );
    if (target) {
      setDispatchJobs((prev) =>
        prev.map((d) =>
          d.referenceCode === target.referenceCode ? { ...d, status: 'Declined' } : d
        )
      );
      if (user) {
        void updateBookingStatusInFirestore(target.referenceCode, 'Cancelled');
        void (async () => {
          const token = await getFreshToken();
          if (!token) return;
          await fetch(`/api/bookings/${encodeURIComponent(target.referenceCode)}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              status: 'Cancelled',
              dispatchStatus: 'Declined',
            }),
          });
        })();
      }
    }
  };

  const handleRescheduleBooking = (id: string, newSlot: string) => {
    const target = bookings.find((b) => b.id === id);
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, timeSlot: newSlot } : b))
    );
    if (target) {
      setDispatchJobs((prev) =>
        prev.map((d) =>
          d.referenceCode === target.referenceCode ? { ...d, scheduledWindow: newSlot } : d
        )
      );
      if (user) {
        void updateBookingSlotInFirestore(target.referenceCode, newSlot);
        void (async () => {
          const token = await getFreshToken();
          if (!token) return;
          await fetch(`/api/bookings/${encodeURIComponent(target.referenceCode)}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ timeSlot: newSlot }),
          });
        })();
      }
    }
  };

  const handleUpdateDispatchStatus = (id: string, status: DispatchStatus) => {
    const target = dispatchJobs.find((d) => d.id === id);
    setDispatchJobs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status } : d))
    );

    if (target) {
      const mappedBookingStatus = mapDispatchToBookingStatus(status);
      if (mappedBookingStatus) {
        setBookings((prev) =>
          prev.map((b) =>
            b.referenceCode === target.referenceCode
              ? { ...b, status: mappedBookingStatus }
              : b
          )
        );
      }

      if (user) {
        if (mappedBookingStatus) {
          void updateBookingStatusInFirestore(target.referenceCode, mappedBookingStatus);
        }
        void (async () => {
          const token = await getFreshToken();
          if (!token) return;
          await fetch(`/api/dispatches/${encodeURIComponent(target.referenceCode)}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              status,
              ...(mappedBookingStatus ? { bookingStatus: mappedBookingStatus } : {}),
            }),
          });
        })();
      }
    }
  };

  const handleSaveGameScore = useCallback(
    async (score: number, dispatchesCleared: number, durationSeconds: number) => {
      const localEntry: GameScoreEntry = {
        id: `local-${Date.now()}`,
        playerName: user?.displayName || 'PulsePro Driver',
        score,
        dispatchesCleared,
        durationSeconds,
        createdAt: new Date().toISOString(),
      };
      setSqlScores((prev) =>
        [localEntry, ...prev].sort((a, b) => b.score - a.score).slice(0, 5)
      );

      if (!user) return;

      void saveScoreToFirestore(score, dispatchesCleared, durationSeconds);
      try {
        const token = await getFreshToken();
        if (!token) return;
        const res = await fetch('/api/game-scores', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ score, dispatchesCleared, durationSeconds }),
        });
        if (res.ok) {
          const data = (await res.json()) as { topScores?: SqlScoreRow[] };
          if (Array.isArray(data.topScores)) {
            setSqlScores(
              data.topScores.map((s) => ({
                id: `sql-sc-${s.id}`,
                playerName: user.displayName || 'PulsePro Driver',
                score: s.score,
                dispatchesCleared: s.dispatchesCleared,
                durationSeconds: s.durationSeconds,
                createdAt: s.createdAt ?? new Date().toISOString(),
              }))
            );
          }
        }
      } catch (err) {
        console.error('Failed to persist score:', err);
      }
    },
    [user, getFreshToken, saveScoreToFirestore]
  );

  // Keep mapDispatchToBookingStatus/mapBookingToDispatchStatus used cleanly
  void mapBookingToDispatchStatus;

  const activeTelemetryPro = SERVICE_PROS[0];

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav
        activeView={activeView}
        onSelectView={setActiveView}
        onPrimaryAction={handleTopPrimaryAction}
        bookingCount={activeBookingsCount}
        pendingDispatchCount={pendingDispatchCount}
      />

      <main className="flex-1">
        {activeView === 'discover' && (
          <DiscoverView
            pros={SERVICE_PROS}
            onBookPro={handleOpenProDrawer}
            onSwitchToConsole={() => setActiveView('pro-console')}
            userDisplayName={user?.displayName || user?.email || null}
            isSigningIn={signingIn}
            onSignInGoogle={() => void signInWithGoogle()}
            onSignOut={() => void signOutUser()}
          />
        )}

        {activeView === 'bookings' && (
          <BookingsView
            bookings={bookings}
            onCancelBooking={handleCancelBooking}
            onRescheduleBooking={handleRescheduleBooking}
            onExplorePros={() => setActiveView('discover')}
          />
        )}

        {activeView === 'pro-console' && (
          <ProConsoleView
            activePro={activeTelemetryPro}
            dispatchJobs={dispatchJobs}
            isAcceptingDispatches={isAcceptingDispatches}
            onToggleAccepting={() => setIsAcceptingDispatches((prev) => !prev)}
            onUpdateDispatchStatus={handleUpdateDispatchStatus}
            onOpenSchedule={() => setActiveView('schedule')}
          />
        )}

        {activeView === 'schedule' && (
          <ProScheduleView
            dispatchJobs={dispatchJobs}
            onUpdateDispatchStatus={handleUpdateDispatchStatus}
            onBackToConsole={() => setActiveView('pro-console')}
          />
        )}

        {activeView === 'game' && (
          <DispatchGame3D
            topScores={combinedTopScores}
            isAuthenticated={Boolean(user)}
            onSignInPrompt={() => void signInWithGoogle()}
            onSaveRunScore={handleSaveGameScore}
            onExitToMarketplace={() => setActiveView('discover')}
          />
        )}
      </main>

      {activeView !== 'game' && (
        <footer className="hidden md:block border-t border-[#6c3bff]/10 bg-[#f8f1ff]/60">
          <div className="max-w-[1440px] mx-auto px-8 py-6 flex items-center justify-between text-xs text-[#6e6a82]">
            <p className="font-semibold text-[#484456]">
              PulsePro Residential Dispatch &amp; Specialist Operations
            </p>
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => setActiveView('discover')}
                className="hover:text-[#1d192a] cursor-pointer"
              >
                Homeowner Marketplace
              </button>
              <button
                type="button"
                onClick={() => setActiveView('pro-console')}
                className="hover:text-[#1d192a] cursor-pointer"
              >
                Specialist Telemetry
              </button>
              <button
                type="button"
                onClick={() => setActiveView('game')}
                className="hover:text-[#1d192a] cursor-pointer"
              >
                3D Dispatch Run
              </button>
              <span>San Francisco Bay Area</span>
            </div>
          </div>
        </footer>
      )}

      <MobileBottomBar
        activeView={activeView}
        onSelectView={setActiveView}
        bookingCount={activeBookingsCount}
        pendingDispatchCount={pendingDispatchCount}
      />

      <BookingDrawer
        pro={drawerPro}
        allPros={SERVICE_PROS}
        initialTab={drawerTab}
        onClose={() => setDrawerPro(null)}
        onSelectPro={(pro) => setDrawerPro(pro)}
        onConfirmBooking={handleConfirmBooking}
        onViewBookings={() => setActiveView('bookings')}
      />
    </div>
  );
}
