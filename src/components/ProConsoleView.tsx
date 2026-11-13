import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  MapPin,
  Navigation,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { MONTHLY_TELEMETRY, WEEKLY_TELEMETRY } from '../data/pulseData';
import { DispatchJob, DispatchStatus, ServicePro } from '../types/pulse';
import { NeighborhoodMap } from './NeighborhoodMap';
import { SafeImage } from './SafeImage';

interface ProConsoleViewProps {
  activePro: ServicePro;
  dispatchJobs: DispatchJob[];
  isAcceptingDispatches: boolean;
  onToggleAccepting: () => void;
  onUpdateDispatchStatus: (id: string, status: DispatchStatus) => void;
  onOpenSchedule: () => void;
}

type QueueFilter = 'All' | 'Pending' | 'Active' | 'Completed';

export const ProConsoleView: React.FC<ProConsoleViewProps> = ({
  activePro,
  dispatchJobs,
  isAcceptingDispatches,
  onToggleAccepting,
  onUpdateDispatchStatus,
  onOpenSchedule,
}) => {
  const [timeframe, setTimeframe] = useState<'week' | 'month'>('week');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('All');
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  const telemetryData = timeframe === 'week' ? WEEKLY_TELEMETRY : MONTHLY_TELEMETRY;

  // Dynamic operational metrics reacting to dispatch state
  const liveStats = useMemo(() => {
    const completedDispatches = dispatchJobs.filter((j) => j.status === 'Completed');
    const activeDispatches = dispatchJobs.filter(
      (j) => j.status === 'Accepted' || j.status === 'En Route' || j.status === 'On Site'
    );
    const pendingCount = dispatchJobs.filter((j) => j.status === 'Pending').length;

    const baseWeekEarnings = WEEKLY_TELEMETRY.reduce((sum, p) => sum + p.earnings, 0);
    const addedCompletedPayout = completedDispatches
      .filter((j) => j.id !== 'dsp-404')
      .reduce((sum, j) => sum + j.payout, 0);

    const totalWeeklyRevenue = baseWeekEarnings + addedCompletedPayout;
    const bookedHours =
      33.5 +
      activeDispatches.reduce((s, j) => s + j.durationHours, 0) +
      completedDispatches
        .filter((j) => j.id !== 'dsp-404')
        .reduce((s, j) => s + j.durationHours, 0);
    const utilizationPct = Math.min(99.4, Math.round((bookedHours / 40) * 1000) / 10);

    return {
      totalWeeklyRevenue,
      bookedHours,
      utilizationPct,
      pendingCount,
      activeCount: activeDispatches.length,
    };
  }, [dispatchJobs]);

  const filteredQueue = useMemo(() => {
    return dispatchJobs.filter((job) => {
      if (queueFilter === 'Pending') return job.status === 'Pending';
      if (queueFilter === 'Active') {
        return (
          job.status === 'Accepted' ||
          job.status === 'En Route' ||
          job.status === 'On Site'
        );
      }
      if (queueFilter === 'Completed') return job.status === 'Completed';
      return job.status !== 'Declined';
    });
  }, [dispatchJobs, queueFilter]);

  const maxEarnings = Math.max(...telemetryData.map((d) => d.earnings), 1);
  const activePoint =
    hoveredBarIndex !== null
      ? telemetryData[hoveredBarIndex]
      : telemetryData[telemetryData.length - 1];

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-28 md:pb-16 space-y-8">
      {/* Pro Console Top Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden border border-[#6c3bff]/14 shrink-0 bg-[#ede4fd]">
            <SafeImage
              src={activePro.avatarUrl}
              alt={activePro.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#6e6a82]">
              <span className="text-[#5308e7]">Specialist Operations</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{activePro.licenseId}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-[#1d192a]">
              {activePro.name}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onToggleAccepting}
            aria-pressed={isAcceptingDispatches}
            className={`h-11 px-4 rounded-xl border text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              isAcceptingDispatches
                ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#005b3d]'
                : 'bg-white border-[#6c3bff]/16 text-[#484456]'
            }`}
          >
            <CheckCircle2
              className={`w-4 h-4 ${isAcceptingDispatches ? 'text-[#10b981]' : 'text-[#6e6a82]'}`}
            />
            {isAcceptingDispatches ? 'Accepting Instant Dispatches' : 'Dispatch Intake Paused'}
          </button>

          <button
            type="button"
            onClick={onOpenSchedule}
            className="h-11 px-4 rounded-xl bg-white border border-[#6c3bff]/18 text-[#5308e7] hover:bg-[#f8f1ff] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            Open Route Schedule
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4-Column KPI Telemetry Strip */}
      <section aria-label="Operational telemetry summary" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="pulse-card rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6e6a82]">
            <span>Weekly Gross Payout</span>
            <DollarSign className="w-4 h-4 text-[#6c3bff]" />
          </div>
          <p className="text-3xl font-extrabold tracking-[-0.02em] text-[#1d192a] tabular-nums">
            ${liveStats.totalWeeklyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs font-semibold text-[#005b3d] tabular-nums">
            +12.4% vs prior 7-day cycle
          </p>
        </div>

        <div className="pulse-card rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6e6a82]">
            <span>Billable Utilization</span>
            <Clock className="w-4 h-4 text-[#6c3bff]" />
          </div>
          <p className="text-3xl font-extrabold tracking-[-0.02em] text-[#1d192a] tabular-nums">
            {liveStats.utilizationPct}%
          </p>
          <p className="text-xs text-[#484456] tabular-nums">
            {liveStats.bookedHours.toFixed(1)} of 40.0 target hrs allocated
          </p>
        </div>

        <div className="pulse-card rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6e6a82]">
            <span>Dispatch Response SLA</span>
            <ShieldCheck className="w-4 h-4 text-[#10b981]" />
          </div>
          <p className="text-3xl font-extrabold tracking-[-0.02em] text-[#1d192a] tabular-nums">
            {activePro.responseTimeMins} min
          </p>
          <p className="text-xs text-[#484456] tabular-nums">
            {liveStats.pendingCount} pending · {liveStats.activeCount} active in queue
          </p>
        </div>

        <div className="pulse-card rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6e6a82]">
            <span>Verified Client Rating</span>
            <Star className="w-4 h-4 fill-[#f59e0b] text-[#f59e0b]" />
          </div>
          <p className="text-3xl font-extrabold tracking-[-0.02em] text-[#1d192a] tabular-nums">
            {activePro.rating.toFixed(2)}
            <span className="text-base font-semibold text-[#6e6a82]"> / 5.0</span>
          </p>
          <p className="text-xs text-[#484456] tabular-nums">
            {activePro.reviewCount} verified homeowner reviews
          </p>
        </div>
      </section>

      {/* Main Split: Revenue Chart + Queue */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Telemetry Chart */}
        <div className="xl:col-span-5 pulse-card rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#1d192a]">Revenue &amp; Hours</h2>
              <p className="text-xs text-[#6e6a82]">
                Hover or tap any bar to inspect cycle breakdown
              </p>
            </div>
            <div className="inline-flex p-1 rounded-xl bg-[#ede4fd]">
              <button
                type="button"
                onClick={() => {
                  setTimeframe('week');
                  setHoveredBarIndex(null);
                }}
                className={`h-8 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  timeframe === 'week'
                    ? 'bg-white text-[#5308e7] shadow-sm'
                    : 'text-[#484456] hover:text-[#1d192a]'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimeframe('month');
                  setHoveredBarIndex(null);
                }}
                className={`h-8 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  timeframe === 'month'
                    ? 'bg-white text-[#5308e7] shadow-sm'
                    : 'text-[#484456] hover:text-[#1d192a]'
                }`}
              >
                30 Days
              </button>
            </div>
          </div>

          {/* Selected Point Readout */}
          <div className="rounded-xl bg-[#f8f1ff] border border-[#6c3bff]/10 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#5308e7]">{activePoint.label} Readout</p>
              <p className="text-2xl font-extrabold text-[#1d192a] tabular-nums">
                ${activePoint.earnings.toLocaleString('en-US')}
              </p>
            </div>
            <div className="text-right text-xs text-[#484456] tabular-nums space-y-0.5">
              <p className="font-semibold text-[#1d192a]">{activePoint.hours.toFixed(1)} billable hrs</p>
              <p>{activePoint.jobs} completed dispatches</p>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="h-52 flex items-end justify-between gap-3 pt-4">
            {telemetryData.map((point, index) => {
              const heightPct = Math.max(16, Math.round((point.earnings / maxEarnings) * 100));
              const isSelected =
                hoveredBarIndex === index ||
                (hoveredBarIndex === null && index === telemetryData.length - 1);

              return (
                <button
                  key={point.label}
                  type="button"
                  onMouseEnter={() => setHoveredBarIndex(index)}
                  onFocus={() => setHoveredBarIndex(index)}
                  onClick={() => setHoveredBarIndex(index)}
                  className="flex-1 h-full flex flex-col items-center justify-end gap-2 group cursor-pointer focus:outline-none"
                >
                  <span className="text-[11px] font-mono font-semibold text-[#6e6a82] group-hover:text-[#5308e7] tabular-nums">
                    ${point.earnings}
                  </span>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-xl transition-all duration-150 ${
                        isSelected
                          ? 'bg-gradient-to-t from-[#5308e7] to-[#8b5cf6] shadow-sm shadow-[#6c3bff]/25'
                          : 'bg-[#e7dff7] group-hover:bg-[#cbbeff]'
                      }`}
                    />
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      isSelected ? 'text-[#5308e7]' : 'text-[#6e6a82]'
                    }`}
                  >
                    {point.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Dispatch Queue */}
        <div className="xl:col-span-7 pulse-card rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#1d192a]">Dispatch Queue</h2>
              <p className="text-xs text-[#6e6a82]">
                Accept incoming residential requests or advance active job telemetry
              </p>
            </div>

            <div className="inline-flex p-1 rounded-xl bg-[#ede4fd] self-start sm:self-auto">
              {(['All', 'Pending', 'Active', 'Completed'] as QueueFilter[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setQueueFilter(tab)}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    queueFilter === tab
                      ? 'bg-white text-[#5308e7] shadow-sm'
                      : 'text-[#484456] hover:text-[#1d192a]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {filteredQueue.length === 0 ? (
            <div className="py-10 text-center space-y-2 border-t border-[#6c3bff]/8">
              <p className="text-sm font-semibold text-[#1d192a]">No jobs in this filter</p>
              <p className="text-xs text-[#6e6a82]">
                New homeowner bookings from the Discover view automatically appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#6c3bff]/10">
              {filteredQueue.map((job) => (
                <div
                  key={job.id}
                  className="py-4 first:pt-2 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-[#6e6a82] tabular-nums">
                        {job.referenceCode}
                      </span>
                      {job.priority === 'Priority' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f59e0b]/12 text-[#9a5b00] font-bold">
                          <AlertTriangle className="w-3 h-3 text-[#f59e0b]" />
                          Priority
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold ${
                          job.status === 'Pending'
                            ? 'bg-[#ede7ff] text-[#5308e7]'
                            : job.status === 'Completed'
                              ? 'bg-[#e7dff7] text-[#484456]'
                              : 'bg-[#10b981]/10 text-[#005b3d]'
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-[#1d192a]">{job.serviceTitle}</h3>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#484456]">
                      <span className="font-semibold text-[#1d192a]">{job.clientName}</span>
                      <span aria-hidden="true" className="text-[#cac3d9]">·</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#6c3bff]" />
                        {job.address}, {job.neighborhood}
                      </span>
                      <span aria-hidden="true" className="text-[#cac3d9]">·</span>
                      <span className="tabular-nums">
                        {job.scheduledDate} · {job.scheduledWindow}
                      </span>
                    </div>

                    <p className="text-xs text-[#6e6a82]">Access: {job.accessNotes}</p>
                  </div>

                  {/* Payout & Operational Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <div className="text-left sm:text-right">
                      <p className="text-base font-extrabold text-[#1d192a] tabular-nums">
                        ${job.payout.toFixed(2)}
                      </p>
                      <p className="text-[11px] text-[#6e6a82] tabular-nums">
                        {job.durationHours} hrs est.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {job.status === 'Pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => onUpdateDispatchStatus(job.id, 'Declined')}
                            aria-label={`Decline ${job.referenceCode}`}
                            className="h-9 px-3 rounded-xl bg-white border border-[#6c3bff]/16 text-[#6e6a82] hover:text-[#ba1a1a] hover:border-[#ef4444]/30 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            Decline
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateDispatchStatus(job.id, 'Accepted')}
                            className="h-9 px-3.5 rounded-xl bg-[#6c3bff] hover:bg-[#5308e7] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Accept
                          </button>
                        </>
                      )}

                      {job.status === 'Accepted' && (
                        <button
                          type="button"
                          onClick={() => onUpdateDispatchStatus(job.id, 'En Route')}
                          className="h-9 px-3.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          Start Route
                        </button>
                      )}

                      {job.status === 'En Route' && (
                        <button
                          type="button"
                          onClick={() => onUpdateDispatchStatus(job.id, 'On Site')}
                          className="h-9 px-3.5 rounded-xl bg-[#6c3bff] hover:bg-[#5308e7] text-white text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Arrive On Site
                        </button>
                      )}

                      {job.status === 'On Site' && (
                        <button
                          type="button"
                          onClick={() => onUpdateDispatchStatus(job.id, 'Completed')}
                          className="h-9 px-3.5 rounded-xl bg-[#005b3d] hover:bg-[#007650] text-white text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Mark Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Live Neighborhood Dispatch Map */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold tracking-[-0.015em] text-[#1d192a]">
              Neighborhood Dispatch Map
            </h2>
            <p className="text-xs text-[#6e6a82]">
              Visualize pending priority requests and active route stops across Bay Area neighborhoods
            </p>
          </div>
        </div>

        <NeighborhoodMap
          mode="dispatch"
          dispatchJobs={dispatchJobs}
          activePro={activePro}
          onUpdateDispatchStatus={onUpdateDispatchStatus}
        />
      </section>
    </div>
  );
};
