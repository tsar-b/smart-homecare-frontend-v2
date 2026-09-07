import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useSite } from '../context/SiteContext';

export function NotFoundPage({ embedded = false }: { readonly embedded?: boolean }) {
  const { locale } = useSite();
  return (
    <section className={`not-found${embedded ? ' not-found--embedded' : ''}`}>
      <div className="container">
        <p className="eyebrow">404 · NOT FOUND</p>
        <h1>{locale === 'ko' ? '요청한 페이지를 찾을 수 없습니다.' : 'That page could not be found.'}</h1>
        <p>{locale === 'ko' ? '주소를 확인하거나 Smart HomeCare 홈에서 다시 시작해 주세요.' : 'Check the address or start again from the Smart HomeCare home page.'}</p>
        <Link className="button button--large" to="/"><ArrowLeft size={18} aria-hidden="true" />{locale === 'ko' ? '홈으로' : 'Back home'}</Link>
      </div>
    </section>
  );
}
