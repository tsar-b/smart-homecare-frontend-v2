import { ArrowRight, Eye, Layers3, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useSite } from '../context/SiteContext';
import { usePageMeta } from '../hooks/usePageMeta';

export function AboutPage() {
  const { locale } = useSite();
  usePageMeta(locale === 'ko' ? 'Smart HomeCare 소개' : 'About Smart HomeCare');
  const values = locale === 'ko'
    ? [
        ['명확한 시작', '고객이 제품을 완벽히 진단해야만 요청할 수 있는 구조를 만들지 않습니다.'],
        ['연결된 기록', '서비스 선택, 일정, 증상, 첨부 자료와 상태를 하나의 요청에 연결합니다.'],
        ['검증 가능한 표현', '운영 근거가 없는 숫자와 약속은 공개 화면에 채워 넣지 않습니다.'],
      ]
    : [
        ['A clear beginning', 'Customers should not need a perfect diagnosis before they can ask for help.'],
        ['A connected record', 'Service, schedule, symptoms, media, and status belong to one request.'],
        ['Verifiable language', 'Public pages should not be filled with unsupported numbers or promises.'],
      ];
  return (
    <>
      <section className="page-hero page-hero--centered">
        <div className="container">
          <p className="eyebrow">ABOUT SMART HOMECARE</p>
          <h1>{locale === 'ko' ? '집 관리 서비스를 더 이해하기 쉬운 흐름으로.' : 'A home-service experience people can understand.'}</h1>
          <p>{locale === 'ko' ? 'Smart HomeCare는 보기 좋은 화면보다 먼저, 요청과 운영이 같은 사실을 바라보는 구조를 만듭니다.' : 'Smart HomeCare starts by giving customers and operations the same clear service record—not merely a polished screen.'}</p>
        </div>
      </section>
      <section className="section">
        <div className="container values-grid">
          {values.map(([title, body], index) => (
            <article key={title}>
              <span>{index === 0 ? <Eye aria-hidden="true" /> : index === 1 ? <Layers3 aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}</span>
              <p className="eyebrow">0{index + 1}</p>
              <h2>{title}</h2>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="section section--blue">
        <div className="container manifesto">
          <p className="manifesto__quote">{locale === 'ko' ? '기능과 디자인은 마지막에 합치는 두 개의 일이 아니라, 처음부터 함께 풀어야 하는 하나의 문제입니다.' : 'Function and design are not two jobs joined at the end; they are one problem solved together from the start.'}</p>
          <div>
            <p>{locale === 'ko' ? '그래서 웹도 앱과 같은 V2 API 경계를 사용하고, 실제 운영 데이터가 준비되지 않은 영역은 그럴듯하게 위장하지 않습니다.' : 'That is why the website uses the same V2 API boundary as the app and does not disguise missing operational data as finished content.'}</p>
            <Link className="button" to="/services">{locale === 'ko' ? '서비스 구조 보기' : 'Explore the service model'} <ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
