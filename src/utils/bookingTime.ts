// The booking API and its availability response use Asia/Seoul. Picker Date
// objects represent calendar days in the device zone, not booking instants.
import { formatMoney, getLocale } from '../i18n/store';
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

export function localDateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function seoulNow(now = new Date()) {
  const shifted = new Date(now.getTime() + SEOUL_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

export function startOfBookingToday(now = new Date()): Date {
  const value = seoulNow(now);
  return new Date(value.year, value.month, value.day);
}

export function isPastBookingSlot(date: Date, time: string, now = new Date()): boolean {
  if (!Number.isFinite(date.getTime()) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return true;
  const selectedDay = localDateKey(date);
  const today = localDateKey(startOfBookingToday(now));
  if (selectedDay !== today) return selectedDay < today;
  const [hour, minute] = time.split(':').map(Number);
  const current = seoulNow(now);
  return hour * 60 + minute <= current.hour * 60 + current.minute;
}

export function formatBookingPrice(value: number): string {
  if (getLocale() === 'en') return formatMoney(value, 'KRW');
  return value === -1 ? '상담 후 안내' : `${value.toLocaleString('ko-KR')}원`;
}
