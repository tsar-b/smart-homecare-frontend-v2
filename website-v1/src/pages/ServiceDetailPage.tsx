import { ArrowLeft, ArrowRight, Check, FileText, Images, SearchCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { ServiceGlyph } from '../components/ServiceGlyph';
import { services, tx } from '../content';
import { useSite } from '../context/SiteContext';
import { usePageMeta } from '../hooks/usePageMeta';
import { NotFoundPage } from './NotFoundPage';

export function ServiceDetailPage() {
  const { serviceSlug } = useParams();
  const { locale } = useSite();
  const service = services.find((item) => item.slug === serviceSlug);
  usePageMeta(service ? tx(service.name, locale) : locale === 'ko' ? '서비스를 찾을 수 없음' : 'Service not found');

  if (!service) return <NotFoundPage embedded />;

  const path = locale === 'ko'
    ? [
        ['제품 확인', '제품 유형과 설치 환경을 선택합니다.'],
        ['증상 기록', '알고 있는 증상만 간단히 남깁니다.'],
        ['일정 요청', '실시간 가능 시간을 확인해 요청합니다.'],
      ]
    : [
        ['Identify the unit', 'Choose the appliance type and setting.'],
        ['Record symptoms', 'Share only what you currently know.'],
        ['Request a time', 'Check live times and make the request.'],
      ];

  return (
    <>
      <section className="service-detail-hero" style={{ '--service-accent': service.accent } as React.CSSProperties}>
        <div className="container">
          <Link className="back-link" to="/services"><ArrowLeft size={17} aria-hidden="true" />{locale === 'ko' ? '모든 서비스' : 'All services'}</Link>
          <div className="service-detail-hero__grid">
            <div>
              <p className="eyebrow">{tx(service.eyebrow, locale)}</p>
              <h1>{tx(service.name, locale)}</h1>
              <p>{tx(service.description, locale)}</p>
              <Link className="button button--large" to={`/book?service=${service.slug}`}>
                {locale === 'ko' ? '이 서비스로 시작' : 'Start with this service'} <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
            <div className="service-detail-hero__symbol" aria-hidden="true">
              <span>{service.name.en.toUpperCase()}</span>
              <ServiceGlyph name={service.icon} size={118} />
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container detail-split">
          <div>
            <p className="eyebrow">AVAILABLE REQUESTS</p>
            <h2>{locale === 'ko' ? '한 화면에서 필요한 범위를 정리합니다' : 'Keep the useful scope in one request'}</h2>
          </div>
          <ul className="capability-list">
            {service.capabilities.map((capability) => (
              <li key={capability.en}><span><Check aria-hidden="true" /></span>{tx(capability, locale)}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section section--soft">
        <div className="container detail-process">
          {path.map(([title, body], index) => (
            <article key={title}>
              <span className="detail-process__icon">
                {index === 0 ? <SearchCheck aria-hidden="true" /> : index === 1 ? <FileText aria-hidden="true" /> : <Images aria-hidden="true" />}
              </span>
              <span className="detail-process__number">0{index + 1}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
