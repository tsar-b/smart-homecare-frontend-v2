import { useEffect, useState } from 'react';
import { getLocale, subscribeLocale } from './store';
export { t, getLocale, setLocale, formatMoney } from './store';
export type { Locale } from './store';
export function useLocale() {
  const [locale, update] = useState(getLocale);
  useEffect(() => {
    const unsubscribe = subscribeLocale(() => update(getLocale()));
    update(getLocale());
    return unsubscribe;
  }, []);
  return locale;
}
