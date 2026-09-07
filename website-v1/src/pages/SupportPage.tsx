import { ArrowRight, MessageCircleQuestion } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useSite } from '../context/SiteContext';
import { usePageMeta } from '../hooks/usePageMeta';

export function SupportPage() {
  const { locale } = useSite();
  usePageMeta(locale === 'ko' ? '고객 지원' : 'Support');
  const faqs = locale === 'ko'
    ? [
        ['정확한 고장 원인을 몰라도 예약할 수 있나요?', '네. 알고 있는 제품 유형과 눈에 보이는 증상만 남기면 됩니다. 원인을 확정하는 표현 대신 현재 상황을 기록해 주세요.'],
        ['사진과 영상은 누가 볼 수 있나요?', '첨부 자료는 공개 갤러리가 아니라 해당 예약에 연결되는 비공개 자료로 설계되어 있습니다. 실제 업로드에는 로그인과 백엔드 미디어 기능이 필요합니다.'],
        ['화면에서 선택한 시간이 바로 확정되나요?', '시간 선택은 예약 요청 단계입니다. 운영 정책과 백엔드 상태가 실제 확정을 반환하기 전에는 확정 일정으로 표시하지 않습니다.'],
        ['가격은 어디에서 확인하나요?', '실시간 카탈로그에 확정된 가격 단계가 있을 때 예약 화면에 표시합니다. 상담이 필요한 항목은 임의의 금액 대신 상담 후 견적으로 구분합니다.'],
      ]
    : [
        ['Can I book without knowing the exact fault?', 'Yes. Share the appliance type and the symptoms you can observe. Record the situation rather than guessing at a diagnosis.'],
        ['Who can see booking photos and videos?', 'Media is designed as private context attached to a booking, not as a public gallery. Real upload requires login and the backend media feature.'],
        ['Is a selected time immediately confirmed?', 'A selected time is part of the request. It is not presented as confirmed until the operational system actually returns that state.'],
        ['Where can I see pricing?', 'Verified pricing tiers from the live catalog appear in the booking flow. Quote-required work remains labeled as a consultation instead of showing an invented amount.'],
      ];
  return (
    <>
      <section className="page-hero">
        <div className="container page-hero__grid">
          <div>
            <p className="eyebrow">CUSTOMER SUPPORT</p>
            <h1>{locale === 'ko' ? '예약 전에 궁금한 내용을 확인하세요.' : 'Get clarity before you make a request.'}</h1>
          </div>
          <p>{locale === 'ko' ? '운영 연락처를 만들어 내는 대신, 현재 확인 가능한 서비스 흐름과 자료 처리 방식을 설명합니다.' : 'This preview explains the verifiable service and data flow without inventing operational contact details.'}</p>
        </div>
      </section>
      <section className="section">
        <div className="container faq-layout">
          <div className="faq-layout__intro">
            <span><MessageCircleQuestion aria-hidden="true" /></span>
            <h2>{locale === 'ko' ? '자주 묻는 질문' : 'Frequently asked questions'}</h2>
            <p>{locale === 'ko' ? '배포 전 실제 사업 정책에 맞춰 운영 시간, 취소 규정, 서비스 지역과 상담 채널을 이곳에 추가할 수 있습니다.' : 'Before launch, this area can receive verified operating hours, cancellation terms, coverage, and support channels.'}</p>
          </div>
          <div className="faq-list">
            {faqs.map(([question, answer], index) => (
              <details key={question} open={index === 0}>
                <summary><span>{question}</span><span aria-hidden="true">+</span></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      <section className="section section--compact">
        <div className="container inline-cta">
          <div><h2>{locale === 'ko' ? '서비스 요청을 준비할까요?' : 'Ready to prepare a service request?'}</h2><p>{locale === 'ko' ? '입력 내용은 제출 전까지 예약으로 확정되지 않습니다.' : 'Nothing is a confirmed booking until you review and submit it.'}</p></div>
          <Link className="button button--large" to="/book">{locale === 'ko' ? '예약 화면으로' : 'Go to booking'} <ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
      </section>
    </>
  );
}
