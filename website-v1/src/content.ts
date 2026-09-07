import type {
  AppInitialization,
  Locale,
  LocalizedText,
  ServiceDefinition,
} from './types';

export function tx(value: LocalizedText, locale: Locale): string {
  return value[locale];
}

export const services: readonly ServiceDefinition[] = [
  {
    slug: 'air-conditioner',
    icon: 'aircon',
    name: { ko: '에어컨', en: 'Air conditioner' },
    eyebrow: { ko: '설치 · 수리 · 세척 · 이전', en: 'Install · repair · clean · relocate' },
    summary: {
      ko: '공간과 제품 유형에 맞춰 필요한 에어컨 서비스를 선택합니다.',
      en: 'Choose the right air-conditioner service for the unit and the space.',
    },
    description: {
      ko: '벽걸이형, 스탠드형, 2-in-1, 천장형 등 제품 유형과 증상을 먼저 확인하고 필요한 작업 범위를 요청할 수 있습니다.',
      en: 'Start with the unit type and the symptoms, then request the right scope for wall, floor, 2-in-1, or ceiling systems.',
    },
    capabilities: [
      { ko: '분해 세척 요청', en: 'Deep-clean request' },
      { ko: '설치 및 이전 상담', en: 'Install and relocation' },
      { ko: '증상 기반 수리 접수', en: 'Symptom-led repair' },
    ],
    accent: '#1769e0',
  },
  {
    slug: 'washing-machine',
    icon: 'washer',
    name: { ko: '세탁기', en: 'Washing machine' },
    eyebrow: { ko: '점검 · 세척 · 수리', en: 'Inspect · clean · repair' },
    summary: {
      ko: '세탁기 유형과 현재 증상을 기록해 정확한 상담을 준비합니다.',
      en: 'Record the washer type and symptoms to prepare a clearer service request.',
    },
    description: {
      ko: '통돌이와 드럼 등 제품 유형, 소음·배수·냄새와 같은 증상, 방문 희망 일정을 한 번에 정리합니다.',
      en: 'Capture the machine type, symptoms such as noise, drainage, or odor, and the preferred visit time in one flow.',
    },
    capabilities: [
      { ko: '유형별 세척 접수', en: 'Type-specific cleaning' },
      { ko: '배수·소음 증상 기록', en: 'Drainage and noise notes' },
      { ko: '사진·영상 자료 첨부', en: 'Photo and video evidence' },
    ],
    accent: '#0d83b8',
  },
  {
    slug: 'refrigerator',
    icon: 'refrigerator',
    name: { ko: '냉장고', en: 'Refrigerator' },
    eyebrow: { ko: '진단 · 수리 상담', en: 'Diagnose · repair' },
    summary: {
      ko: '냉각, 소음, 누수 등 문제 상황을 방문 전에 전달합니다.',
      en: 'Share cooling, noise, or leakage symptoms before the visit.',
    },
    description: {
      ko: '모델과 설치 환경, 증상 발생 시점, 필요한 사진을 정리해 현장 확인 전 상담의 정확도를 높입니다.',
      en: 'Organize the model, installation context, symptom timing, and useful media so the first conversation starts with better context.',
    },
    capabilities: [
      { ko: '냉각 이상 접수', en: 'Cooling issue request' },
      { ko: '누수·소음 기록', en: 'Leak and noise details' },
      { ko: '설치 환경 전달', en: 'Installation context' },
    ],
    accent: '#3158c8',
  },
  {
    slug: 'television',
    icon: 'television',
    name: { ko: 'TV', en: 'Television' },
    eyebrow: { ko: '설치 · 연결 · 점검', en: 'Install · connect · inspect' },
    summary: {
      ko: '설치 환경과 화면·연결 문제를 구분해 요청합니다.',
      en: 'Separate installation needs from display or connection issues.',
    },
    description: {
      ko: '벽면과 스탠드 설치, 주변 기기 연결, 화면과 전원 문제 등 필요한 작업을 서비스 요청에 담습니다.',
      en: 'Describe wall or stand installation, peripheral connections, display behavior, and power issues in the request.',
    },
    capabilities: [
      { ko: '벽걸이·스탠드 설치', en: 'Wall or stand install' },
      { ko: '화면·전원 점검', en: 'Display and power checks' },
      { ko: '주변 기기 연결', en: 'Device connections' },
    ],
    accent: '#5147c7',
  },
];

export const copy = {
  nav: {
    services: { ko: '서비스', en: 'Services' },
    process: { ko: '이용 방법', en: 'How it works' },
    about: { ko: '소개', en: 'About' },
    support: { ko: '고객 지원', en: 'Support' },
    account: { ko: '내 계정', en: 'Account' },
    book: { ko: '예약 시작', en: 'Start booking' },
  },
  common: {
    learnMore: { ko: '자세히 보기', en: 'Learn more' },
    viewServices: { ko: '서비스 둘러보기', en: 'Explore services' },
    sourceLive: { ko: 'V2 실시간 카탈로그', en: 'Live V2 catalog' },
    sourcePreview: { ko: '미리보기 카탈로그', en: 'Preview catalog' },
    backHome: { ko: '홈으로 돌아가기', en: 'Back to home' },
  },
  home: {
    eyebrow: { ko: 'SMART HOMECARE · SERVICE PLATFORM', en: 'SMART HOMECARE · SERVICE PLATFORM' },
    titleLead: { ko: '집 관리가 필요할 때,', en: 'When your home needs care,' },
    titleAccent: { ko: '시작은 선명하게.', en: 'start with clarity.' },
    intro: {
      ko: '에어컨, 세탁기, 냉장고, TV 서비스 요청을 한 흐름으로 준비하고 진행 상태를 확인하세요.',
      en: 'Prepare appliance service requests in one clear flow—from the first symptom to booking status.',
    },
    heroNote: {
      ko: '서비스 선택 · 일정 확인 · 사진/영상 첨부 준비',
      en: 'Choose a service · check a time · attach useful media',
    },
    serviceEyebrow: { ko: 'SERVICE CATALOG', en: 'SERVICE CATALOG' },
    serviceTitle: { ko: '필요한 관리부터 선택하세요', en: 'Start with the appliance that needs care' },
    serviceIntro: {
      ko: '기존 앱의 핵심 서비스 구조를 웹에서도 같은 흐름으로 확장할 수 있게 구성했습니다.',
      en: 'The web experience follows the same service structure as the app and is ready to grow from the same catalog.',
    },
    processEyebrow: { ko: 'ONE CLEAR PATH', en: 'ONE CLEAR PATH' },
    processTitle: { ko: '예약은 세 단계면 충분합니다', en: 'A service request in three clear steps' },
    trustEyebrow: { ko: 'BUILT FOR TRUST', en: 'BUILT FOR TRUST' },
    trustTitle: { ko: '신뢰는 과장된 숫자보다 과정에서 시작됩니다', en: 'Trust starts with a visible process, not inflated numbers' },
    finalTitle: { ko: '무엇이 필요한지 아직 정확하지 않아도 괜찮습니다.', en: 'You do not need a perfect diagnosis to begin.' },
    finalBody: {
      ko: '제품과 증상을 선택하고 필요한 자료를 남기면, 상담에 필요한 맥락을 한곳에 정리할 수 있습니다.',
      en: 'Choose the appliance, describe what happened, and keep the context needed for the next conversation in one place.',
    },
  },
} as const;

export const previewInitialization: AppInitialization = {
  version: 'preview-2026.09',
  catalog: {
    categories: services.map((service, index) => ({
      id: `preview-category-${service.slug}`,
      key: service.slug,
      label: service.name.ko,
      sortOrder: index,
    })),
    serviceTypes: services.map((service, index) => ({
      id: `preview-service-${service.slug}`,
      categoryId: `preview-category-${service.slug}`,
      key: service.slug,
      label: service.name.ko,
      sortOrder: index,
    })),
    subtypes: services.map((service) => ({
      id: `preview-subtype-${service.slug}`,
      key: `${service.slug}-standard`,
      label: `${service.name.ko} 기본 상담`,
      category: service.slug,
    })),
    pricingTiers: services.map((service) => ({
      id: `preview-pricing-${service.slug}`,
      serviceTypeId: `preview-service-${service.slug}`,
      serviceType: service.slug,
      subtype: `preview-subtype-${service.slug}`,
      key: `${service.slug}-estimate`,
      label: '상담 후 견적',
      basePrice: 0,
      sortOrder: 0,
      memo: '실제 가격 정보 연결 전 미리보기 항목',
    })),
    options: [],
  },
  settings: { timezone: 'Asia/Seoul', currency: 'KRW' },
  localization: { defaultLocale: 'ko', supportedLocales: ['ko', 'en'] },
};
