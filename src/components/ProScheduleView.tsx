import { CalendarDays, CheckCircle2, Clock, MapPin, Navigation } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { DATE_OPTIONS } from '../data/pulseData';
import { DispatchJob, DispatchStatus } from '../types/pulse';

interface ProScheduleViewProps {
  dispatchJobs: DispatchJob[];
  onUpdateDispatchStatus: (id: string, status: DispatchStatus) => void;
  onBackToConsole: () => void;
}

export const ProScheduleView: React.FC<ProScheduleViewProps> = ({
  dispatchJobs,
  onUpdateDispatchStatus,
  onBackToConsole,
}) => {
  const [selectedDay, setSelectedDay] = useState<string>('All');

  const scheduledJobs = useMemo(() => {
    return dispatchJobs.filter((j) => {
      if (j.status === 'Declined') return false;
      if (selectedDay === 'All') return true;
      return j.scheduledDate.includes(selectedDay);
    });
  }, [dispatchJobs, selectedDay]);

  const totalHours = scheduledJobs.reduce((sum, j) => sum + j.durationHours, 0);
  const totalPayout = scheduledJobs.reduce((sum, j) => sum + j.payout, 0);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-28 md:pb-16 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-[#5308e7] tracking-[0.04em] uppercase">
            Field Route &amp; Timeblocks
          </p>
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-[#1d192a]">
            Daily Dispatch Schedule
          </h1>
          <p className="text-sm text-[#484456] tabular-nums">
            {scheduledJobs.length} scheduled visits · {totalHours} billable hrs · $
            {totalPayout.toLocaleString('en-US')} projected payout
          </p>
        </div>

        <button
          type="button"
          onClick={onBackToConsole}
          className="h-10 px-4 rounded-xl bg-white border border-[#6c3bff]/18 text-[#5308e7] hover:bg-[#f8f1ff] text-xs font-semibold cursor-pointer self-start sm:self-auto"
        >
          Back to Telemetry Console
        </button>
      </div>

      {/* Horizontal Day Scroller */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSelectedDay('All')}
          className={`h-10 px-4 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
            selectedDay === 'All'
              ? 'bg-[#6c3bff] text-white shadow-sm shadow-[#6c3bff]/25'
              : 'bg-[#ede7ff] text-[#484456] hover:text-[#1d192a]'
          }`}
        >
          All Upcoming Days
        </button>
        {DATE_OPTIONS.map((d) => {
          const active = selectedDay === d.date;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setSelectedDay(d.date)}
              className={`h-10 px-4 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors tabular-nums ${
                active
                  ? 'bg-[#6c3bff] text-white shadow-sm shadow-[#6c3bff]/25'
                  : 'bg-[#ede7ff] text-[#484456] hover:text-[#1d192a]'
              }`}
            >
              {d.day} Nov {d.date}
            </button>
          );
        })}
      </div>

      {/* Route Timeline */}
      {scheduledJobs.length === 0 ? (
        <div className="pulse-card rounded-2xl p-10 text-center space-y-3">
          <CalendarDays className="w-8 h-8 text-[#6c3bff] mx-auto" />
          <h2 className="text-lg font-bold text-[#1d192a]">No route stops for this day</h2>
          <p className="text-sm text-[#6e6a82]">
            Select &ldquo;All Upcoming Days&rdquo; or accept pending dispatches from your Pro Console.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {scheduledJobs.map((job, idx) => (
            <div
              key={job.id}
              className="pulse-card rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-[#ede7ff] text-[#5308e7] font-mono font-bold text-sm flex items-center justify-center shrink-0 tabular-nums">
                  0{idx + 1}
                </div>

                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-[#5308e7] tabular-nums">
                      {job.scheduledDate} · {job.scheduledWindow}
                    </span>
                    <span aria-hidden="true" className="text-[#cac3d9]">·</span>
                    <span className="font-mono text-[#6e6a82]">{job.referenceCode}</span>
                    <span aria-hidden="true" className="text-[#cac3d9]">·</span>
                    <span
                      className={`font-semibold ${
                        job.status === 'Completed'
                          ? 'text-[#484456]'
                          : job.status === 'Pending'
                            ? 'text-[#9a5b00]'
                            : 'text-[#005b3d]'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-[#1d192a]">{job.serviceTitle}</h2>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#484456]">
                    <span className="font-semibold text-[#1d192a]">{job.clientName}</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#6c3bff]" />
                      {job.address}, {job.neighborhood}
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Clock className="w-3.5 h-3.5 text-[#6c3bff]" />
                      {job.durationHours} hrs
                    </span>
                  </div>

                  <p className="text-xs text-[#6e6a82]">Gate &amp; Entry: {job.accessNotes}</p>
                </div>
              </div>

              <div className="flex md:flex-col items-center md:items-end justify-between gap-3 shrink-0 border-t md:border-t-0 pt-4 md:pt-0 border-[#6c3bff]/8">
                <p className="text-lg font-extrabold text-[#1d192a] tabular-nums">
                  ${job.payout.toFixed(2)}
                </p>

                <div className="flex items-center gap-2">
                  {job.status === 'Pending' && (
                    <button
                      type="button"
                      onClick={() => onUpdateDispatchStatus(job.id, 'Accepted')}
                      className="h-10 px-4 rounded-xl bg-[#6c3bff] hover:bg-[#5308e7] text-white text-xs font-semibold cursor-pointer"
                    >
                      Accept Slot
                    </button>
                  )}
                  {job.status === 'Accepted' && (
                    <button
                      type="button"
                      onClick={() => onUpdateDispatchStatus(job.id, 'En Route')}
                      className="h-10 px-4 rounded-xl bg-[#10b981] hover:bg-[#059669] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Start Route
                    </button>
                  )}
                  {job.status === 'En Route' && (
                    <button
                      type="button"
                      onClick={() => onUpdateDispatchStatus(job.id, 'On Site')}
                      className="h-10 px-4 rounded-xl bg-[#6c3bff] hover:bg-[#5308e7] text-white text-xs font-semibold cursor-pointer"
                    >
                      Check In On Site
                    </button>
                  )}
                  {job.status === 'On Site' && (
                    <button
                      type="button"
                      onClick={() => onUpdateDispatchStatus(job.id, 'Completed')}
                      className="h-10 px-4 rounded-xl bg-[#005b3d] hover:bg-[#007650] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Complete Visit
                    </button>
                  )}
                  {job.status === 'Completed' && (
                    <span className="text-xs font-semibold text-[#005b3d] inline-flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                      Payout Settled
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
