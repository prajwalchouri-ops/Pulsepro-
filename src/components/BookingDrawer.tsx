import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { DATE_OPTIONS } from '../data/pulseData';
import { BookingRecord, ServicePro } from '../types/pulse';
import { SafeImage } from './SafeImage';

interface BookingDrawerProps {
  pro: ServicePro | null;
  allPros: ServicePro[];
  initialTab: 'book' | 'profile';
  onClose: () => void;
  onSelectPro: (pro: ServicePro) => void;
  onConfirmBooking: (booking: Omit<BookingRecord, 'id' | 'referenceCode' | 'createdAt' | 'status'>) => BookingRecord;
  onViewBookings: () => void;
}

const DURATION_OPTIONS = [2, 3, 4, 6];
const PROTECTION_FEE = 18;

export const BookingDrawer: React.FC<BookingDrawerProps> = ({
  pro,
  allPros,
  initialTab,
  onClose,
  onSelectPro,
  onConfirmBooking,
  onViewBookings,
}) => {
  const [activeTab, setActiveTab] = useState<'book' | 'profile'>(initialTab);
  const [selectedDateId, setSelectedDateId] = useState(DATE_OPTIONS[0].id);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [hours, setHours] = useState(2);
  const [neighborhood, setNeighborhood] = useState('');
  const [address, setAddress] = useState('2140 Vallejo St, Residence 4');
  const [serviceSummary, setServiceSummary] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState<BookingRecord | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (pro) {
      setSelectedSlot(pro.availableSlots[0] ?? '09:00 AM');
      setNeighborhood(pro.neighborhoods[0] ?? 'Pacific Heights, SF');
      setServiceSummary(pro.specialties[0] ?? pro.role);
      setConfirmedBooking(null);
    }
  }, [pro]);

  if (!pro) return null;

  const selectedDateObj = DATE_OPTIONS.find((d) => d.id === selectedDateId) ?? DATE_OPTIONS[0];
  const subtotal = pro.hourlyRate * hours;
  const totalAmount = subtotal + PROTECTION_FEE;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    const created = onConfirmBooking({
      proId: pro.id,
      proName: pro.name,
      proRole: pro.role,
      proAvatar: pro.avatarUrl,
      serviceSummary: serviceSummary.trim() || pro.specialties[0],
      neighborhood,
      address: address.trim(),
      dateLabel: selectedDateObj.full,
      timeSlot: selectedSlot,
      hours,
      hourlyRate: pro.hourlyRate,
      protectionFee: PROTECTION_FEE,
      totalAmount,
      notes: notes.trim() || 'Standard residential arrival.',
    });
    setConfirmedBooking(created);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Book or inspect ${pro.name}`}
      className="fixed inset-0 z-50 flex justify-end bg-[#191526]/40 backdrop-blur-sm"
    >
      <div className="w-full max-w-xl bg-[#fdf7ff] h-full overflow-y-auto pulse-floating border-l border-[#6c3bff]/12 flex flex-col">
        {/* Drawer Header */}
        <div className="sticky top-0 z-10 pulse-glass border-b border-[#6c3bff]/10 px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl overflow-hidden border border-[#6c3bff]/12 shrink-0 bg-[#ede4fd]">
              <SafeImage
                src={pro.avatarUrl}
                alt={pro.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[#1d192a] truncate">{pro.name}</h2>
              <p className="text-xs text-[#6e6a82] truncate">{pro.role}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="w-10 h-10 rounded-xl bg-white border border-[#6c3bff]/12 flex items-center justify-center text-[#484456] hover:text-[#1d192a] hover:bg-[#ede7ff] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Pro Switcher + Mode Tabs */}
        {!confirmedBooking && (
          <div className="px-6 pt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex p-1 rounded-xl bg-[#ede4fd]">
                <button
                  type="button"
                  onClick={() => setActiveTab('book')}
                  className={`h-9 px-4 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === 'book'
                      ? 'bg-white text-[#5308e7] shadow-sm'
                      : 'text-[#484456] hover:text-[#1d192a]'
                  }`}
                >
                  Schedule Dispatch
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className={`h-9 px-4 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === 'profile'
                      ? 'bg-white text-[#5308e7] shadow-sm'
                      : 'text-[#484456] hover:text-[#1d192a]'
                  }`}
                >
                  Credentials &amp; Reviews
                </button>
              </div>

              <select
                value={pro.id}
                onChange={(e) => {
                  const found = allPros.find((item) => item.id === e.target.value);
                  if (found) onSelectPro(found);
                }}
                aria-label="Switch specialist"
                className="h-9 px-3 rounded-xl bg-white border border-[#6c3bff]/14 text-xs font-semibold text-[#1d192a] focus:outline-none cursor-pointer"
              >
                {allPros.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} (${item.hourlyRate}/hr)
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Drawer Body */}
        <div className="flex-1 px-6 py-5 space-y-6">
          {confirmedBooking ? (
            <div className="pulse-card rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#10b981]/12 flex items-center justify-center text-[#10b981]">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#005b3d]">Dispatch Confirmed</p>
                  <h3 className="text-xl font-bold text-[#1d192a]">
                    Booking {confirmedBooking.referenceCode}
                  </h3>
                </div>
              </div>

              <p className="text-sm text-[#484456] leading-relaxed">
                {confirmedBooking.proName} has received your dispatch request and is scheduled for{' '}
                <span className="font-semibold text-[#1d192a]">
                  {confirmedBooking.dateLabel} at {confirmedBooking.timeSlot}
                </span>
                . This job is also live in the Pro Operational Console.
              </p>

              <div className="border-t border-[#6c3bff]/10 pt-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#6e6a82]">Service Scope</span>
                  <span className="font-semibold text-[#1d192a] text-right">
                    {confirmedBooking.serviceSummary}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6e6a82]">Location</span>
                  <span className="font-semibold text-[#1d192a] text-right">
                    {confirmedBooking.address} · {confirmedBooking.neighborhood}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6e6a82]">Estimated Total</span>
                  <span className="font-bold text-[#5308e7] tabular-nums">
                    ${confirmedBooking.totalAmount.toFixed(2)} ({confirmedBooking.hours} hrs)
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onViewBookings();
                  }}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#6c3bff] text-white text-sm font-semibold cursor-pointer"
                >
                  View in My Bookings
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-12 px-5 rounded-xl bg-white border border-[#6c3bff]/16 text-[#5308e7] text-sm font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : activeTab === 'profile' ? (
            <div className="space-y-6">
              <div className="pulse-card rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#005b3d]">
                    <ShieldCheck className="w-4 h-4 text-[#10b981]" />
                    Background Checked · {pro.licenseId}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-[#1d192a] tabular-nums">
                    <Star className="w-4 h-4 fill-[#f59e0b] text-[#f59e0b]" />
                    {pro.rating.toFixed(2)} ({pro.reviewCount})
                  </span>
                </div>
                <p className="text-sm text-[#484456] leading-relaxed">{pro.bio}</p>
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#6c3bff]/8 text-center">
                  <div>
                    <p className="text-lg font-bold text-[#1d192a] tabular-nums">
                      ${pro.hourlyRate}
                    </p>
                    <p className="text-xs text-[#6e6a82]">Hourly Rate</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[#1d192a] tabular-nums">
                      {pro.completedJobs}
                    </p>
                    <p className="text-xs text-[#6e6a82]">Completed</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[#1d192a] tabular-nums">
                      {pro.responseTimeMins}m
                    </p>
                    <p className="text-xs text-[#6e6a82]">Avg Response</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#1d192a]">Verified Client Reviews</h3>
                {pro.reviews.map((rev) => (
                  <div key={rev.id} className="pulse-card rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#1d192a]">
                        {rev.author}{' '}
                        <span className="font-normal text-xs text-[#6e6a82]">
                          · {rev.neighborhood}
                        </span>
                      </p>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#1d192a] tabular-nums">
                        <Star className="w-3.5 h-3.5 fill-[#f59e0b] text-[#f59e0b]" />
                        {rev.rating.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-sm text-[#484456] leading-relaxed">{rev.comment}</p>
                    <p className="text-xs text-[#6e6a82]">{rev.date}</p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('book')}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#6c3bff] text-white text-sm font-semibold cursor-pointer"
              >
                Continue to Scheduling
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Date Picker */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-[#484456] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#6c3bff]" />
                  Select Date
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {DATE_OPTIONS.map((item) => {
                    const active = selectedDateId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedDateId(item.id)}
                        className={`py-2.5 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                          active
                            ? 'bg-[#6c3bff] border-[#6c3bff] text-white shadow-sm shadow-[#6c3bff]/25'
                            : 'bg-white border-[#6c3bff]/12 text-[#1d192a] hover:border-[#6c3bff]/30'
                        }`}
                      >
                        <span
                          className={`block text-[11px] font-semibold ${
                            active ? 'text-white/80' : 'text-[#6e6a82]'
                          }`}
                        >
                          {item.day}
                        </span>
                        <span className="block text-base font-bold tabular-nums mt-0.5">
                          {item.date}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Slot */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-[#484456] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#6c3bff]" />
                  Arrival Window
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {pro.availableSlots.map((slot) => {
                    const active = selectedSlot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`h-11 px-3 rounded-xl border text-xs font-semibold tabular-nums transition-all cursor-pointer ${
                          active
                            ? 'bg-[#ede7ff] border-[#6c3bff] text-[#5308e7]'
                            : 'bg-white border-[#6c3bff]/12 text-[#484456] hover:border-[#6c3bff]/30'
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Estimated Duration */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-[#484456]">Estimated Scope Duration</label>
                <div className="grid grid-cols-4 gap-2">
                  {DURATION_OPTIONS.map((hrs) => {
                    const active = hours === hrs;
                    return (
                      <button
                        key={hrs}
                        type="button"
                        onClick={() => setHours(hrs)}
                        className={`h-11 rounded-xl border text-xs font-semibold tabular-nums transition-all cursor-pointer ${
                          active
                            ? 'bg-[#ede7ff] border-[#6c3bff] text-[#5308e7]'
                            : 'bg-white border-[#6c3bff]/12 text-[#484456] hover:border-[#6c3bff]/30'
                        }`}
                      >
                        {hrs} Hours
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Service Scope & Address */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="service-scope" className="text-xs font-bold text-[#484456]">
                    Primary Service Scope
                  </label>
                  <select
                    id="service-scope"
                    value={serviceSummary}
                    onChange={(e) => setServiceSummary(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-white border border-[#6c3bff]/14 text-sm font-medium text-[#1d192a] focus:outline-none focus:border-[#6c3bff]"
                  >
                    {pro.specialties.map((spec) => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="booking-neighborhood" className="text-xs font-bold text-[#484456]">
                      Neighborhood
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-[#6c3bff] absolute left-3 top-3.5" />
                      <select
                        id="booking-neighborhood"
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        className="w-full h-11 pl-9 pr-3 rounded-xl bg-white border border-[#6c3bff]/14 text-sm font-medium text-[#1d192a] focus:outline-none focus:border-[#6c3bff]"
                      >
                        {pro.neighborhoods.map((area) => (
                          <option key={area} value={area}>
                            {area}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="booking-address" className="text-xs font-bold text-[#484456]">
                      Street Address
                    </label>
                    <input
                      id="booking-address"
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street & unit"
                      className="w-full h-11 px-3.5 rounded-xl bg-white border border-[#6c3bff]/14 text-sm font-medium text-[#1d192a] focus:outline-none focus:border-[#6c3bff]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="booking-notes" className="text-xs font-bold text-[#484456]">
                    Access &amp; Property Notes
                  </label>
                  <textarea
                    id="booking-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Gate code, parking notes, or specific fixture details..."
                    className="w-full p-3 rounded-xl bg-white border border-[#6c3bff]/14 text-sm text-[#1d192a] placeholder:text-[#6e6a82] focus:outline-none focus:border-[#6c3bff]"
                  />
                </div>
              </div>

              {/* Pricing Breakdown */}
              <div className="pulse-card rounded-2xl p-4 space-y-2.5 text-sm">
                <div className="flex justify-between text-[#484456]">
                  <span className="tabular-nums">
                    ${pro.hourlyRate}/hr × {hours} hrs
                  </span>
                  <span className="font-semibold text-[#1d192a] tabular-nums">
                    ${subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[#484456]">
                  <span>PulsePro Protection &amp; Vetting</span>
                  <span className="font-semibold text-[#1d192a] tabular-nums">
                    ${PROTECTION_FEE.toFixed(2)}
                  </span>
                </div>
                <div className="pt-2.5 border-t border-[#6c3bff]/10 flex justify-between items-baseline">
                  <span className="font-bold text-[#1d192a]">Estimated Total</span>
                  <span className="text-xl font-extrabold text-[#5308e7] tabular-nums">
                    ${totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-12 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#6c3bff] hover:from-[#7c3aed] hover:to-[#5308e7] text-white text-sm font-semibold shadow-md shadow-[#6c3bff]/25 active:scale-[0.98] transition-all cursor-pointer"
              >
                Confirm Dispatch · ${totalAmount.toFixed(2)}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
