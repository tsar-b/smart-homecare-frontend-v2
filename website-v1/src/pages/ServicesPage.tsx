import { ArrowRight, DatabaseZap } from 'lucide-react';
import { Link } from 'react-router-dom';

import { CatalogStatus } from '../components/CatalogStatus';
import { ServiceGrid } from '../components/ServiceGrid';
import { useSite } from '../context/SiteContext';
import { usePageMeta } from '../hooks/usePageMeta';

export function ServicesPage() {
  const { catalogSource, initialization, locale } = useSite();
  usePageMeta(locale === 'ko' ? '서비스' : 'Services');

  return (
    <>
      <section className="page-hero">
        <div className="container page-hero__grid">
          <div>
            <p className="eyebrow">SERVICE CATALOG</p>
            <h1>{locale === 'ko' ? '제품이 아니라 필요한 일부터 찾습니다.' : 'Find the work you need, not a maze of products.'}</h1>
          </div>
          <p>
            {locale === 'ko'
              ? '기존 앱의 에어컨, 세탁기, 냉장고, TV 구조를 웹에서도 명확하게 탐색하고 예약으로 이어지게 구성했습니다.'
              : 'The existing app’s air-conditioner, washer, refrigerator, and television structure now leads cleanly from web discovery to booking.'}
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <ServiceGrid locale={locale} />
        </div>
      </section>

      <section className="section section--soft">
        <div className="container catalog-panel">
          <div className="catalog-panel__heading">
            <span className="catalog-panel__icon"><DatabaseZap aria-hidden="true" /></span>
            <div>
              <p className="eyebrow">V2 DATA BOUNDARY</p>
              <h2>{locale === 'ko' ? '웹과 앱이 같은 카탈로그를 봅니다' : 'Web and app share the same catalog boundary'}</h2>
            </div>
            <CatalogStatus />
          </div>
          <p>
            {locale === 'ko'
              ? '백엔드가 연결되면 이 화면은 Supabase를 직접 읽지 않고 V2 API의 서비스 카탈로그를 사용합니다. 지금 연결된 항목 수는 아래와 같습니다.'
              : 'When the backend is reachable, this site reads the V2 API catalog instead of accessing Supabase tables directly. The current catalog boundary is summarized below.'}
          </p>
          <div className="catalog-panel__metrics">
            <div><strong>{initialization.catalog.categories.length}</strong><span>{locale === 'ko' ? '카테고리' : 'Categories'}</span></div>
            <div><strong>{initialization.catalog.serviceTypes.length}</strong><span>{locale === 'ko' ? '서비스 유형' : 'Service types'}</span></div>
            <div><strong>{initialization.catalog.subtypes.length}</strong><span>{locale === 'ko' ? '제품 하위 유형' : 'Subtypes'}</span></div>
            <div><strong>{initialization.catalog.pricingTiers.length}</strong><span>{locale === 'ko' ? '가격 단계' : 'Pricing tiers'}</span></div>
          </div>
          {catalogSource !== 'live' ? (
            <p className="catalog-panel__note">
              {locale === 'ko'
                ? '현재 수치는 구조 확인용 미리보기입니다. 미리보기 ID로는 실제 예약을 제출할 수 없습니다.'
                : 'These counts currently describe preview structure. Preview IDs can never submit a real booking.'}
            </p>
          ) : null}
        </div>
      </section>

      <section className="section section--compact">
        <div className="container inline-cta">
          <div>
            <h2>{locale === 'ko' ? '필요한 서비스를 찾았나요?' : 'Found the service you need?'}</h2>
            <p>{locale === 'ko' ? '제품과 증상을 선택해 예약 요청을 준비하세요.' : 'Choose the appliance and symptoms to prepare a service request.'}</p>
          </div>
          <Link className="button button--large" to="/book">
            {locale === 'ko' ? '예약 준비하기' : 'Prepare a booking'} <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
