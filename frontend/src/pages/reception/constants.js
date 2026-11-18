import dayjs from 'dayjs';

// Bảng màu & font theo UI mockup phần Lễ tân
export const TEAL = '#5fa8ad';
export const TEAL_DARK = '#4a9196';
export const TEAL_LIGHT = '#e7f2f3';
export const TEAL_SOFT = '#f1f8f8';
export const TEXT = '#2b2b2b';
export const MUTED = '#8a8f94';
export const BORDER = '#e6e9ec';
export const PAGE_BG = '#f8f9fa';
export const DANGER = '#d9534f';
export const SERIF = "'Times New Roman', Times, Georgia, serif";

export const ALL_SPECIALTIES = 'all';

export const THEME = {
  token: {
    colorPrimary: TEAL,
    colorLink: TEAL,
    fontFamily: SERIF,
    borderRadius: 8,
    colorText: TEXT,
  },
};

export const STATUS_META = {
  Confirmed: { label: 'Waiting', color: TEAL_DARK, bg: TEAL_LIGHT },
  'Checked-in': { label: 'Checked-in', color: '#2f7d4f', bg: '#e8f5ed' },
  Completed: { label: 'Completed', color: '#5b6470', bg: '#eef0f3' },
  Cancelled: { label: 'Cancelled', color: DANGER, bg: '#fbeceb' },
};

/** '14:30' -> '02:30 PM' (định dạng giờ như mockup) */
export const formatTime12h = (time) => (time ? dayjs(`2000-01-01T${time}`).format('hh:mm A') : '');

/** '2026-10-06' -> 'Oct 6, 2026' */
export const formatDateShort = (date) => (date ? dayjs(date).format('MMM D, YYYY') : '');

export const greeting = () => {
  const hour = dayjs().hour();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

// Khung giờ chuẩn, khớp với SLOTS trong backend/clinic_api/booking.py
export const SLOT_TIMES = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30'];

/**
 * Ghép danh sách giờ trống từ API thành trạng thái từng khung giờ:
 * available | booked (đã có người đặt) | past (đã qua).
 */
export const buildSlotBoard = (date, availableSlots) => {
  const available = new Set((availableSlots || []).map((slot) => slot.slice(0, 5)));
  const now = dayjs();
  const isToday = date === now.format('YYYY-MM-DD');
  const isPast = dayjs(date).isBefore(now, 'day');
  return SLOT_TIMES.map((time) => {
    let state = 'booked';
    if (available.has(time)) state = 'available';
    else if (isPast || (isToday && time <= now.format('HH:mm'))) state = 'past';
    return { time, state };
  });
};
