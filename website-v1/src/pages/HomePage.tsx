import {
  ArrowRight,
  CalendarCheck2,
  Camera,
  Check,
  ClipboardList,
  Clock3,
  FileCheck2,
  MapPin,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { SectionHeading } from '../components/SectionHeading';
import { ServiceGlyph } from '../components/ServiceGlyph';
import { ServiceGrid } from '../components/ServiceGrid';
import { copy, services, tx } from '../content';
import { useSite } from '../context/SiteContext';
import { usePageMeta } from '../hooks/usePageMeta';

export function HomePage() {
  const { locale } = useSite();
  usePageMeta(
    locale === 'ko' ? '집 관리의 시작' : 'Home care, clearly connected',
    tx(copy.home.intro, locale),
  );

  const steps = locale === 'ko'
    ? [
        ['01', '서비스 선택', '제품과 필요한 작업을 먼저 고릅니다.'],
        ['02', '상황 전달', '증상, 주소, 사진과 영상을 한곳에 정리합니다.'],
        ['03', '일정 요청', '가능한 시간을 확인하고 예약 요청을 제출합니다.'],
      ]
    : [
        ['01', 'Choose a service', 'Start with the appliance and the work you need.'],
        ['02', 'Share the context', 'Keep symptoms, address, photos, and video together.'],
        ['03', 'Request a time', 'Check live availability and submit the service request.'],
      ];

  const principles = locale === 'ko'
    ? [
        ['먼저 확인', '가격이나 작업을 단정하기 전에 제품과 증상을 확인하는 구조입니다.'],
        ['한곳에 기록', '예약 정보와 첨부 자료가 같은 요청에 연결되도록 준비했습니다.'],
        ['상태를 구분', '선택, 요청, 확인 상태를 같은 의미처럼 보이지 않게 설계합니다.'],
      ]
    : [
        ['Context first', 'The flow checks the appliance and symptoms before implying scope or price.'],
        ['One useful record', 'Booking details and private media are designed to stay with the same request.'],
        ['Honest states', 'Selection, request, and confirmation are treated as different operational states.'],
      ];

  return (
    <>
      <section className="hero">
        <div className="hero__wash" aria-hidden="true" />
        <div className="container hero__grid">
          <div className="hero__copy">
            <p className="eyebrow">{tx(copy.home.eyebrow, locale)}</p>
            <h1>
              {tx(copy.home.titleLead, locale)}
              <span>{tx(copy.home.titleAccent, locale)}</span>
            </h1>
            <p className="hero__intro">{tx(copy.home.intro, locale)}</p>
            <div className="hero__actions">
              <Link className="button button--large" to="/book">
                {tx(copy.nav.book, locale)}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link className="button button--large button--secondary" to="/services">
                {tx(copy.common.viewServices, locale)}
              </Link>
            </div>
            <p className="hero__note">
              <Check size={16} aria-hidden="true" />
              {tx(copy.home.heroNote, locale)}
            </p>
          </div>

          <div className="hero-console" aria-label={locale === 'ko' ? '예약 흐름 미리보기' : 'Booking flow preview'}>
            <div className="hero-console__head">
              <div>
                <span>{locale === 'ko' ? '관리 요청' : 'CARE REQUEST'}</span>
                <strong>{locale === 'ko' ? '어떤 도움이 필요하세요?' : 'What needs attention?'}</strong>
              </div>
              <span className="hero-console__status">
                <span aria-hidden="true" />
                {locale === 'ko' ? '준비 중' : 'Draft'}
              </span>
            </div>
            <div className="hero-console__services">
              {services.map((service, index) => (
                <div className={`hero-service${index === 0 ? ' hero-service--active' : ''}`} key={service.slug}>
                  <ServiceGlyph name={service.icon} size={23} />
                  <span>{tx(service.name, locale)}</span>
                </div>
              ))}
            </div>
            <div className="hero-console__house">
              <div className="house-line house-line--roof" aria-hidden="true" />
              <div className="house-line house-line--left" aria-hidden="true" />
              <div className="house-line house-line--right" aria-hidden="true" />
              <div className="house-room house-room--air">
                <Wrench size={19} aria-hidden="true" />
                <span>{locale === 'ko' ? '증상 기록' : 'Issue notes'}</span>
              </div>
              <div className="house-room house-room--media">
                <Camera size={19} aria-hidden="true" />
                <span>{locale === 'ko' ? '사진·영상' : 'Photo · video'}</span>
              </div>
              <div className="house-room house-room--place">
                <MapPin size={19} aria-hidden="true" />
                <span>{locale === 'ko' ? '방문 위치' : 'Visit address'}</span>
              </div>
            </div>
            <div className="hero-console__schedule">
              <CalendarCheck2 size={20} aria-hidden="true" />
              <div>
                <span>{locale === 'ko' ? '다음 단계' : 'NEXT STEP'}</span>
                <strong>{locale === 'ko' ? '방문 일정 확인' : 'Check a visit time'}</strong>
              </div>
              <ArrowRight size={18} aria-hidden="true" />
            </div>
          </div>
        </div>
        <div className="container hero__utility" aria-label={locale === 'ko' ? '서비스 특징' : 'Service highlights'}>
          <span><Clock3 size={17} aria-hidden="true" />{locale === 'ko' ? '실시간 일정 연결 준비' : 'Live schedule ready'}</span>
          <span><ShieldCheck size={17} aria-hidden="true" />{locale === 'ko' ? '비공개 예약 자료' : 'Private booking media'}</span>
          <span><FileCheck2 size={17} aria-hidden="true" />{locale === 'ko' ? 'V2 기록 구조' : 'V2 service record'}</span>
        </div>
      </section>

      <section className="section" id="services">
        <div className="container">
          <SectionHeading
            eyebrow={tx(copy.home.serviceEyebrow, locale)}
            title={tx(copy.home.serviceTitle, locale)}
            description={tx(copy.home.serviceIntro, locale)}
            action={
              <Link className="text-link text-link--large" to="/services">
                {tx(copy.common.viewServices, locale)} <ArrowRight size={17} aria-hidden="true" />
              </Link>
            }
          />
          <ServiceGrid locale={locale} />
        </div>
      </section>

      <section className="section section--blue" id="process">
        <div className="container">
          <SectionHeading
            eyebrow={tx(copy.home.processEyebrow, locale)}
            title={tx(copy.home.processTitle, locale)}
            centered
          />
          <div className="process-line">
            {steps.map(([number, title, body], index) => (
              <article className="process-step" key={number}>
                <div className="process-step__number">{number}</div>
                <div className="process-step__icon">
                  {index === 0 ? <ClipboardList aria-hidden="true" /> : index === 1 ? <Camera aria-hidden="true" /> : <CalendarCheck2 aria-hidden="true" />}
                </div>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--ink">
        <div className="container trust-layout">
          <div className="trust-layout__intro">
            <p className="eyebrow">{tx(copy.home.trustEyebrow, locale)}</p>
            <h2>{tx(copy.home.trustTitle, locale)}</h2>
            <p>
              {locale === 'ko'
                ? '검증되지 않은 후기나 숫자를 채우는 대신, 사용자가 실제로 확인할 수 있는 서비스 흐름을 먼저 만들었습니다.'
                : 'Instead of filling the page with unverified reviews or numbers, the experience begins with a process users can understand.'}
            </p>
            <Link className="button button--light" to="/about">
              {locale === 'ko' ? 'SHC 방식 보기' : 'See the SHC approach'}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <div className="trust-list">
            {principles.map(([title, body], index) => (
              <article key={title}>
                <span>0{index + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container media-story">
          <div className="media-story__visual" aria-hidden="true">
            <div className="media-story__card media-story__card--before">
              <span>{locale === 'ko' ? '요청 전' : 'BEFORE'}</span>
              <Wrench size={42} />
              <p>{locale === 'ko' ? '증상과 환경이 흩어져 있음' : 'Context is scattered'}</p>
            </div>
            <div className="media-story__bridge"><ArrowRight /></div>
            <div className="media-story__card media-story__card--after">
              <span>{locale === 'ko' ? '요청 후' : 'AFTER'}</span>
              <Sparkles size={42} />
              <p>{locale === 'ko' ? '한 예약에 필요한 정보가 연결됨' : 'The request keeps it together'}</p>
            </div>
          </div>
          <div className="media-story__copy">
            <p className="eyebrow">CONTEXT, NOT CLUTTER</p>
            <h2>{locale === 'ko' ? '사진과 영상도 장식이 아니라 맥락입니다' : 'Photos and video are context, not decoration'}</h2>
            <p>
              {locale === 'ko'
                ? '제품 모델, 설치 환경, 소리나 누수 같은 증상을 방문 전에 전달할 수 있도록 예약 자료에 비공개로 연결합니다.'
                : 'Private booking media can show the model, installation setting, sound, leakage, or another symptom before a visit.'}
            </p>
            <ul className="check-list">
              <li><Check aria-hidden="true" />{locale === 'ko' ? '예약 생성 후 비공개 업로드' : 'Private upload after booking creation'}</li>
              <li><Check aria-hidden="true" />{locale === 'ko' ? '사진 10MB, 영상 45MB 제한 반영' : '10 MB image and 45 MB video limits'}</li>
              <li><Check aria-hidden="true" />{locale === 'ko' ? '운영자와 요청자 권한 경계' : 'Customer and operator access boundary'}</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section section--compact">
        <div className="container final-cta">
          <div>
            <p className="eyebrow">START WITH WHAT YOU KNOW</p>
            <h2>{tx(copy.home.finalTitle, locale)}</h2>
            <p>{tx(copy.home.finalBody, locale)}</p>
          </div>
          <Link className="button button--large button--light" to="/book">
            {tx(copy.nav.book, locale)} <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
