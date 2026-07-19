'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getCampTypeLabel, getCampTypeColor, formatDateRange, getStatusColor, getStatusLabel } from '@/lib/utils/helpers';

interface Booking {
  id: string;
  booking_code: string;
  customer_name: string;
  check_in: string;
  check_out: string;
  status: string;
  room_id: string;
}

interface Room {
  id: string;
  name: string;
  floor_label: string;
  camp_id: string;
  camps: {
    name: string;
  };
}

export default function AdminScheduleCalendarPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Month & Year selection
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Generate array of years
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch active rooms & camps
      const { data: roomsData } = await supabase
        .from('rooms')
        .select(`
          id, name, floor_label, camp_id,
          camps (name)
        `)
        .eq('is_active', true);
      
      setRooms((roomsData as any) || []);

      // Calculate start and end date of selected month for fetching bookings
      const startOfMonthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const endOfMonthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${lastDay}`;

      // Fetch bookings overlapping with the selected month
      // Overlap formula: check_in <= endOfMonth and check_out >= startOfMonth
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('id, booking_code, customer_name, check_in, check_out, status, room_id')
        .not('status', 'in', '("cancelled","expired")')
        .lte('check_in', endOfMonthStr)
        .gte('check_out', startOfMonthStr);

      setBookings((bookingsData as any) || []);

    } catch (err) {
      console.error('Error fetching calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to count number of days in selected month
  const getDaysInMonth = () => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  };

  // Helper to check the occupancy status of a room on a specific day
  const getDayOccupancy = (roomId: string, day: number) => {
    const checkDate = new Date(selectedYear, selectedMonth, day);
    checkDate.setHours(12, 0, 0, 0); // Noon comparison

    const match = bookings.find((b) => {
      if (b.room_id !== roomId) return false;
      const inDate = new Date(b.check_in);
      const outDate = new Date(b.check_out);
      inDate.setHours(0, 0, 0, 0);
      outDate.setHours(23, 59, 59, 999);
      return checkDate >= inDate && checkDate <= outDate;
    });

    return match || null;
  };

  const daysCount = getDaysInMonth();
  const dayHeaders = Array.from({ length: daysCount }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-md font-bold text-on-surface">Timeline Jadwal Kamar</h1>
          <p className="text-body-md text-on-surface-variant">Visualisasi okupansi harian dan jadwal tinggal seluruh kamar.</p>
        </div>

        {/* Date Filter Grid */}
        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="p-2 border border-[#EAEAEA] rounded-lg text-sm bg-white outline-none focus:border-[#b52330] font-medium"
          >
            {months.map((m, idx) => (
              <option key={m} value={idx}>{m}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="p-2 border border-[#EAEAEA] rounded-lg text-sm bg-white outline-none focus:border-[#b52330] font-medium"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Legend Info */}
      <div className="flex items-center gap-4 text-xs font-semibold select-none bg-white p-3 rounded-lg border border-[#EAEAEA] shadow-sm">
        <span className="text-outline uppercase">Legenda:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-emerald-500"></span>
          <span>Confirmed (Aktif)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-amber-500"></span>
          <span>Hold / Pending</span>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="bg-white rounded-xl border border-[#EAEAEA] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-outline">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : rooms.length === 0 ? (
          <p className="p-8 text-center text-outline font-medium">Belum ada kamar aktif yang terdaftar</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[1200px]">
              
              {/* Grid Header Row */}
              <div className="grid grid-cols-12 border-b border-[#EAEAEA] bg-neutral-50 text-label-sm text-outline font-bold">
                <div className="col-span-3 p-3 border-r border-[#EAEAEA]">Nama Kamar</div>
                <div className="col-span-9 grid grid-flow-col auto-cols-max">
                  {dayHeaders.map((day) => (
                    <div
                      key={day}
                      className="w-8 h-10 flex items-center justify-center border-r border-[#EAEAEA] text-center"
                    >
                      {day}
                    </div>
                  ))}
                </div>
              </div>

              {/* Grid Rooms Row */}
              <div className="divide-y divide-[#EAEAEA]">
                {rooms.map((room) => (
                  <div key={room.id} className="grid grid-cols-12 hover:bg-neutral-50/20">
                    {/* Room Info */}
                    <div className="col-span-3 p-3 border-r border-[#EAEAEA] flex flex-col justify-center min-w-0">
                      <span className="font-bold text-on-surface truncate">{room.camps?.name}</span>
                      <span className="text-[10px] text-outline font-medium truncate">{room.name} ({room.floor_label})</span>
                    </div>

                    {/* Room Occupancy Days */}
                    <div className="col-span-9 grid grid-flow-col auto-cols-max">
                      {dayHeaders.map((day) => {
                        const booking = getDayOccupancy(room.id, day);
                        const isConfirmed = booking?.status === 'confirmed';

                        return (
                          <div
                            key={day}
                            title={booking ? `${booking.customer_name} (${booking.booking_code}) \nCheck-In: ${booking.check_in} \nCheck-Out: ${booking.check_out}` : 'Tersedia'}
                            className={`w-8 h-12 border-r border-[#EAEAEA] flex items-center justify-center transition-colors relative group ${
                              booking
                                ? isConfirmed
                                  ? 'bg-emerald-500 text-white cursor-pointer hover:bg-emerald-600'
                                  : 'bg-amber-500 text-white cursor-pointer hover:bg-amber-600'
                                : 'hover:bg-neutral-50 cursor-pointer'
                            }`}
                          >
                            {booking && (
                              <span className="text-[9px] font-black select-none">
                                {booking.booking_code.split('-').pop()?.slice(0, 2)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
