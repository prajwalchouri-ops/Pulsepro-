import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  XCircle,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { BookingRecord, BookingStatus } from '../types/pulse';
import { SafeImage } from './SafeImage';

interface BookingsViewProps {
  bookings: BookingRecord[];
  onCancelBooking: (id: string) => void;
  onRescheduleBooking: (id: string, newSlot: string) => void;
  onExplorePros: () => void;
}

type BookingFilter = 'all' | 'upcoming' | 'completed' | 'cancelled';

const STATUS_STYLE: Record<
  BookingStatus,
  { bg: string; text: string; icon: React.ReactNode }
> = {
  Confirmed: {
    bg: 'bg-[#ede7ff]',
    text: 'text-[#5308e7]',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#6c3bff]" />,
  },
  'En Route': {
    bg: 'bg-[#10b981]/10',
    text: 'text-[#005b3d]',
    icon: <Navigation className="w-3.5 h-3.5 text-[#10b981]" />,
  },
  'On Site': {
    bg: 'bg-[#10b981]/10',
    text: 'text-[#005b3d]',
    icon: <Clock className="w-3.5 h-3.5 text-[#10b981]" />,
  },
  Completed: {
    bg: 'bg-[#e7dff7]',
    text: 'text-[#484456]',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#484456]" />,
  },
  Cancelled: {
    bg: 'bg-[#ef4444]/10',
    text: 'text-[#ba1a1a]',
    icon: <XCircle className="w-3.5 h-3.5 text-[#ef4444]" />,
  },
};

const QUICK_RESCHEDULE_SLOTS = ['09:00 AM', '11:30 AM', '02:00 PM', '04:30 PM'];

export const BookingsView: React.FC<BookingsViewProps> = ({
  bookings,
  onCancelBooking,
  onRescheduleBooking,
  onExplorePros,
}) => {
  const [filter, setFilter] = useState<BookingFilter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (filter === 'upcoming') {
        return b.status === 'Confirmed' || b.status === 'En Route' || b.status === 'On Site';
      }
      if (filter === 'completed') return b.status === 'Completed';
      if (filter === 'cancelled') return b.status === 'Cancelled';
      return true;
    });
  }, [bookings, filter]);

  const activeCount = bookings.filter(
    (b) => b.status === 'Confirmed' || b.status === 'En Route' || b.status === 'On Site'
  ).length;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-28 md:pb-16 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-[#5308e7] tracking-[0.04em] uppercase">
            Homeowner Dispatch Tracker
          </p>
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-[#1d192a]">
            Scheduled Home Visits
          </h1>
          <p className="text-sm text-[#484456]">
            {activeCount} active {activeCount === 1 ? 'appointment' : 'appointments'} with live arrival status and guaranteed hourly pricing.
          </p>
        </div>

        {/* Segmented Filter */}
        <div className="inline-flex p-1 rounded-xl bg-[#ede4fd] self-start sm:self-auto">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'completed', label: 'Completed' },
              { id: 'cancelled', label: 'Cancelled' },
            ] as { id: BookingFilter; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`h-9 px-3.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-white text-[#5308e7] shadow-sm'
                  : 'text-[#484456] hover:text-[#1d192a]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div className="pulse-card rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#ede7ff] text-[#5308e7] flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-lg font-bold text-[#1d192a]">No bookings in this view</h2>
            <p className="text-sm text-[#6e6a82]">
              Browse vetted Bay Area specialists to schedule an immediate or upcoming home dispatch.
            </p>
          </div>
          <button
            type="button"
            onClick={onExplorePros}
            className="h-11 px-5 rounded-xl bg-[#6c3bff] hover:bg-[#5308e7] text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            Discover Specialists
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredBookings.map((booking) => {
            const statusStyle = STATUS_STYLE[booking.status];
            const isEditable =
              booking.status === 'Confirmed' || booking.status === 'En Route';

            return (
              <article
                key={booking.id}
                className="pulse-card rounded-2xl p-6 flex flex-col justify-between gap-5"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-[#6c3bff]/10 shrink-0 bg-[#ede4fd]">
                        <SafeImage
                          src={booking.proAvatar}
                          alt={booking.proName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-[#6e6a82] tabular-nums">
                            {booking.referenceCode}
                          </span>
                          <span aria-hidden="true" className="text-[#cac3d9]">·</span>
                          <span className="text-xs text-[#6e6a82] truncate">
                            {booking.neighborhood}
                          </span>
                        </div>
                        <h2 className="text-lg font-bold text-[#1d192a] truncate">
                          {booking.proName}
                        </h2>
                        <p className="text-xs text-[#484456] truncate">{booking.proRole}</p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold shrink-0 ${statusStyle.bg} ${statusStyle.text}`}
                    >
                      {statusStyle.icon}
                      {booking.status}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-[#6c3bff]/8 space-y-2 text-sm">
                    <p className="font-semibold text-[#1d192a]">{booking.serviceSummary}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#484456]">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#6c3bff]" />
                        {booking.dateLabel} · {booking.timeSlot}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#6c3bff]" />
                        {booking.address}
                      </span>
                    </div>
                    {booking.notes && (
                      <p className="text-xs text-[#6e6a82] pt-1">
                        Notes: {booking.notes}
                      </p>
                    )}
                  </div>

                  {editingId === booking.id && (
                    <div className="pt-3 border-t border-[#6c3bff]/10 space-y-2">
                      <p className="text-xs font-bold text-[#484456]">
                        Select a new arrival window
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {QUICK_RESCHEDULE_SLOTS.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => {
                              onRescheduleBooking(booking.id, slot);
                              setEditingId(null);
                            }}
                            className={`h-9 px-3 rounded-xl text-xs font-semibold border tabular-nums cursor-pointer transition-colors ${
                              booking.timeSlot === slot
                                ? 'bg-[#6c3bff] text-white border-[#6c3bff]'
                                : 'bg-white border-[#6c3bff]/16 text-[#1d192a] hover:bg-[#f8f1ff]'
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[#6c3bff]/8 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-[#6e6a82]">
                      Estimated Total ({booking.hours} hrs)
                    </p>
                    <p className="text-lg font-bold text-[#1d192a] tabular-nums">
                      ${booking.totalAmount.toFixed(2)}
                    </p>
                  </div>

                  {isEditable && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingId((prev) => (prev === booking.id ? null : booking.id))
                        }
                        className="h-10 px-3.5 rounded-xl bg-white border border-[#6c3bff]/16 text-[#5308e7] hover:bg-[#f8f1ff] text-xs font-semibold transition-colors cursor-pointer"
                      >
                        {editingId === booking.id ? 'Close' : 'Reschedule'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onCancelBooking(booking.id)}
                        className="h-10 px-3.5 rounded-xl bg-white border border-[#ef4444]/25 text-[#ba1a1a] hover:bg-[#ffdad6]/40 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
