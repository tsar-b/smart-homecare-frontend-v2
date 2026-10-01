import { english } from './english';
export type Locale = 'ko' | 'en';
let locale: Locale = 'ko';
const listeners = new Set<() => void>();
export const getLocale = () => locale;
export function setLocale(value: Locale) {
  if (value !== 'ko' && value !== 'en') return;
  if (value === locale) return;
  locale = value;
  listeners.forEach(notify => notify());
}
export function subscribeLocale(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// Complete Korean source messages are stable resource keys. Unknown catalog or
// user-authored content stays verbatim; identifiers and API payloads never pass
// through this display-only function.
export function t(message: string, params?: Record<string, string | number>): string {
  const key = message.trim().replace(/\s+/g, ' ');
  const translated = locale === 'en' ? (english[key] ?? message) : message;
  return params ? translated.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : match) : translated;
}

export function formatMoney(amount: number, currency = 'KRW', language: Locale = locale): string {
  if (amount === -1) return language === 'en' ? 'Quote after consultation' : '상담 후 안내';
  // A currency code is formatting configuration, NOT conversion. Callers must
  // supply an amount denominated in that currency. SHC catalog amounts are KRW.
  return new Intl.NumberFormat(language === 'ko' ? 'ko-KR' : 'en-US', {
    style: 'currency', currency, currencyDisplay: 'code',
    ...(currency === 'KRW' ? { maximumFractionDigits: 0, minimumFractionDigits: 0 } : {})
  }).format(amount);
}
