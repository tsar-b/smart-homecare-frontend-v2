import { CheckCircle2, CloudOff, LoaderCircle, RotateCw } from 'lucide-react';

import { copy, tx } from '../content';
import { useSite } from '../context/SiteContext';

export function CatalogStatus() {
  const { catalogSource, locale, reloadCatalog } = useSite();
  if (catalogSource === 'loading') {
    return (
      <span className="catalog-status catalog-status--loading">
        <LoaderCircle size={14} className="spin" aria-hidden="true" />
        {locale === 'ko' ? '카탈로그 연결 중' : 'Connecting catalog'}
      </span>
    );
  }
  if (catalogSource === 'live') {
    return (
      <span className="catalog-status catalog-status--live">
        <CheckCircle2 size={14} aria-hidden="true" />
        {tx(copy.common.sourceLive, locale)}
      </span>
    );
  }
  return (
    <button className="catalog-status catalog-status--preview" type="button" onClick={reloadCatalog}>
      {catalogSource === 'error' ? <CloudOff size={14} aria-hidden="true" /> : <RotateCw size={14} aria-hidden="true" />}
      {tx(copy.common.sourcePreview, locale)}
    </button>
  );
}
