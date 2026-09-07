import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  FileImage,
  Film,
  LoaderCircle,
  LockKeyhole,
  Paperclip,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  createBooking,
  fetchAvailability,
  ShcApiError,
  uploadBookingMedia,
} from '../api/shcApi';
import { formatFileSize, validateBookingMedia } from '../bookingMedia';
import { CatalogStatus } from '../components/CatalogStatus';
import { ServiceGlyph } from '../components/ServiceGlyph';
import { services, tx } from '../content';
import { useSite } from '../context/SiteContext';
import { usePageMeta } from '../hooks/usePageMeta';
import type { BookingPayload, CreatedBooking, SelectedBookingMedia } from '../types';

type AvailabilityState = 'idle' | 'loading' | 'ready' | 'error';

interface BookingFormState {
  readonly serviceTypeId: string;
  readonly subtypeId: string;
  readonly pricingTierId: string;
  readonly name: string;
  readonly phone: string;
  readonly address: string;
  readonly detailAddress: string;
  readonly symptom: string;
  readonly memo: string;
  readonly date: string;
  readonly time: string;
}

const emptyForm: BookingFormState = {
  serviceTypeId: '',
  subtypeId: '',
  pricingTierId: '',
  name: '',
  phone: '',
  address: '',
  detailAddress: '',
  symptom: '',
  memo: '',
  date: '',
  time: '',
};

function todayInSeoul(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}`;
}

function serviceTerms(slug: string): readonly string[] {
  if (slug === 'air-conditioner') return ['air', '에어컨'];
  if (slug === 'washing-machine') return ['wash', '세탁'];
  if (slug === 'refrigerator') return ['refrigerator', 'fridge', '냉장'];
  return ['television', 'tv', '티비', '텔레비전'];
}

function pricingMatches(
  service: { id: string; key: string; label: string },
  subtype: { id: string; key: string; label: string },
  pricing: { serviceTypeId: string | null; serviceType: string | null; subtype: string | null },
): boolean {
  const serviceTokens = new Set([service.id, service.key, service.label]);
  const subtypeTokens = new Set([subtype.id, subtype.key, subtype.label]);
  const serviceMatch = pricing.serviceTypeId
    ? serviceTokens.has(pricing.serviceTypeId)
    : Boolean(pricing.serviceType && serviceTokens.has(pricing.serviceType));
  return serviceMatch && Boolean(pricing.subtype && subtypeTokens.has(pricing.subtype));
}

function formatPrice(value: number, locale: 'ko' | 'en'): string {
  if (value < 0) return locale === 'ko' ? '상담 후 견적' : 'Quote after consultation';
  if (value === 0) return locale === 'ko' ? '가격 확인 필요' : 'Price to be confirmed';
  return new Intl.NumberFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value);
}

export function BookingPage() {
  const { catalogSource, initialization, locale, session } = useSite();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState<BookingFormState>(emptyForm);
  const [media, setMedia] = useState<readonly SelectedBookingMedia[]>([]);
  const [mediaErrors, setMediaErrors] = useState<readonly string[]>([]);
  const [availability, setAvailability] = useState<readonly { time: string; available: boolean }[]>([]);
  const [availabilityState, setAvailabilityState] = useState<AvailabilityState>('idle');
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityAttempt, setAvailabilityAttempt] = useState(0);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatedBooking | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const submissionRef = useRef<{ fingerprint: string; id: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  usePageMeta(locale === 'ko' ? '예약 요청' : 'Booking request');

  const catalog = initialization.catalog;
  const selectedService = catalog.serviceTypes.find((item) => item.id === form.serviceTypeId) ?? null;
  const eligibleSubtypes = useMemo(() => {
    if (!selectedService) return [];
    return catalog.subtypes.filter((subtype) =>
      catalog.pricingTiers.some((pricing) => pricingMatches(selectedService, subtype, pricing)),
    );
  }, [catalog.pricingTiers, catalog.subtypes, selectedService]);
  const pricingChoices = useMemo(() => {
    const subtype = eligibleSubtypes.find((item) => item.id === form.subtypeId);
    if (!selectedService || !subtype) return [];
    const matching = catalog.pricingTiers.filter((pricing) =>
      pricingMatches(selectedService, subtype, pricing),
    );
    const keyCounts = matching.reduce<Map<string, number>>((counts, pricing) => {
      const key = pricing.key.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map());
    return matching
      .filter((pricing) => keyCounts.get(pricing.key.toLowerCase()) === 1)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, 'ko'));
  }, [catalog.pricingTiers, eligibleSubtypes, form.subtypeId, selectedService]);

  useEffect(() => {
    if (!catalog.serviceTypes.length || form.serviceTypeId) return;
    const requested = searchParams.get('service');
    const terms = requested ? serviceTerms(requested) : [];
    const match = catalog.serviceTypes.find((item) => {
      const haystack = `${item.key} ${item.label}`.toLowerCase();
      return terms.some((term) => haystack.includes(term));
    });
    setForm((current) => ({ ...current, serviceTypeId: (match ?? catalog.serviceTypes[0]).id }));
  }, [catalog.serviceTypes, form.serviceTypeId, searchParams]);

  useEffect(() => {
    if (eligibleSubtypes.some((item) => item.id === form.subtypeId)) return;
    const nextSubtypeId = eligibleSubtypes[0]?.id ?? '';
    if (form.subtypeId === nextSubtypeId) return;
    setForm((current) => ({
      ...current,
      subtypeId: nextSubtypeId,
      pricingTierId: '',
    }));
  }, [eligibleSubtypes, form.subtypeId]);

  useEffect(() => {
    if (!pricingChoices.length) {
      if (form.pricingTierId) setForm((current) => ({ ...current, pricingTierId: '' }));
      return;
    }
    if (pricingChoices.some((item) => item.id === form.pricingTierId)) return;
    setForm((current) => ({ ...current, pricingTierId: pricingChoices[0].id }));
  }, [form.pricingTierId, pricingChoices]);

  useEffect(() => {
    if (catalogSource !== 'live' || !form.date) {
      setAvailability([]);
      setAvailabilityState('idle');
      setAvailabilityError(null);
      setForm((current) => (current.time ? { ...current, time: '' } : current));
      return;
    }
    const controller = new AbortController();
    setAvailabilityState('loading');
    setAvailabilityError(null);
    void fetchAvailability(form.date, controller.signal)
      .then((slots) => {
        setAvailability(slots);
        setAvailabilityState('ready');
        setForm((current) => {
          if (!current.time || slots.some((slot) => slot.time === current.time && slot.available)) return current;
          return { ...current, time: '' };
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setAvailability([]);
        setAvailabilityState('error');
        setAvailabilityError(error instanceof Error ? error.message : '일정 정보를 불러오지 못했습니다.');
      });
    return () => controller.abort();
  }, [availabilityAttempt, catalogSource, form.date]);

  function update<K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSubmitError(null);
  }

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const next = validateBookingMedia(media, Array.from(event.target.files ?? []));
    setMedia(next.accepted);
    setMediaErrors(next.errors);
    event.target.value = '';
  }

  function removeMedia(id: string) {
    setMedia((current) => current.filter((item) => item.id !== id));
    setMediaErrors([]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setUploadWarning(null);

    if (catalogSource !== 'live') {
      setSubmitError(locale === 'ko' ? '실제 예약 제출에는 V2 백엔드 연결이 필요합니다.' : 'Connect the V2 backend before submitting a real booking.');
      return;
    }
    if (!session?.accessToken) {
      setSubmitError(locale === 'ko' ? '예약 제출 전에 로그인해 주세요.' : 'Sign in before submitting the booking.');
      return;
    }
    if (!form.serviceTypeId || !form.subtypeId || !form.pricingTierId || !form.name.trim() || !form.date || !form.time || !consent) {
      setSubmitError(locale === 'ko' ? '필수 입력과 개인정보 안내 확인을 완료해 주세요.' : 'Complete the required fields and privacy acknowledgment.');
      return;
    }

    const stableBody = {
      service_type_id: form.serviceTypeId,
      subtype_id: form.subtypeId,
      pricing_tier_id: form.pricingTierId,
      options: [],
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      detail_address: form.detailAddress.trim() || undefined,
      symptom: form.symptom.trim() || undefined,
      memo: form.memo.trim() || undefined,
      reservation_date: form.date,
      reservation_time: form.time,
      timezone: initialization.settings.timezone || 'Asia/Seoul',
    } as const;
    const fingerprint = JSON.stringify(stableBody);
    const submissionId = submissionRef.current?.fingerprint === fingerprint
      ? submissionRef.current.id
      : crypto.randomUUID();
    submissionRef.current = { fingerprint, id: submissionId };
    const payload: BookingPayload = { client_request_id: submissionId, ...stableBody };

    setSubmitting(true);
    try {
      const created = await createBooking(payload, session.accessToken);
      setResult(created);
      const failed: string[] = [];
      for (const item of media) {
        setUploadProgress((current) => ({ ...current, [item.id]: 0.02 }));
        try {
          await uploadBookingMedia(created.id, item, session.accessToken, (ratio) => {
            setUploadProgress((current) => ({ ...current, [item.id]: ratio }));
          });
          setUploadProgress((current) => ({ ...current, [item.id]: 1 }));
        } catch {
          failed.push(item.file.name);
          setUploadProgress((current) => ({ ...current, [item.id]: -1 }));
        }
      }
      if (failed.length) {
        setUploadWarning(
          locale === 'ko'
            ? `예약은 생성되었지만 ${failed.length}개 첨부 파일 업로드를 완료하지 못했습니다.`
            : `The booking was created, but ${failed.length} attachment upload(s) did not finish.`,
        );
      }
    } catch (error) {
      if (error instanceof ShcApiError && error.code === 'BOOKING_SLOT_UNAVAILABLE') {
        setAvailabilityAttempt((value) => value + 1);
        update('time', '');
        setSubmitError(locale === 'ko' ? '선택한 시간이 방금 마감되었습니다. 새 시간을 선택해 주세요.' : 'That time has just become unavailable. Choose another slot.');
      } else {
        setSubmitError(error instanceof Error ? error.message : (locale === 'ko' ? '예약을 제출하지 못했습니다.' : 'The booking could not be submitted.'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <section className="booking-success">
        <div className="container booking-success__card">
          <span className="booking-success__icon"><CheckCircle2 aria-hidden="true" /></span>
          <p className="eyebrow">REQUEST RECEIVED</p>
          <h1>{locale === 'ko' ? '예약 요청이 접수되었습니다.' : 'Your booking request was received.'}</h1>
          <p>{locale === 'ko' ? '선택한 시간은 요청 상태이며, 운영 확인 전까지 확정 일정으로 표시하지 않습니다.' : 'The selected time is a request and is not presented as confirmed until operations confirms it.'}</p>
          <dl>
            <div><dt>{locale === 'ko' ? '예약 ID' : 'Booking ID'}</dt><dd>{result.id}</dd></div>
            <div><dt>{locale === 'ko' ? '현재 상태' : 'Current status'}</dt><dd>{result.status}</dd></div>
            <div><dt>{locale === 'ko' ? '요청 일정' : 'Requested time'}</dt><dd>{result.reservationDate ?? form.date} · {result.reservationTime ?? form.time}</dd></div>
          </dl>
          {media.length ? (
            <div className="upload-summary">
              <h2>{locale === 'ko' ? '첨부 자료' : 'Attachments'}</h2>
              {media.map((item) => {
                const progress = uploadProgress[item.id] ?? 0;
                return <div key={item.id}><span>{item.file.name}</span><strong>{progress < 0 ? (locale === 'ko' ? '실패' : 'Failed') : progress >= 1 ? (locale === 'ko' ? '완료' : 'Ready') : `${Math.round(progress * 100)}%`}</strong></div>;
              })}
            </div>
          ) : null}
          {uploadWarning ? <p className="form-message form-message--warning" role="status">{uploadWarning}</p> : null}
          <div className="booking-success__actions">
            <Link className="button button--large" to="/">{locale === 'ko' ? '홈으로' : 'Back home'} <ArrowRight size={18} aria-hidden="true" /></Link>
            <Link className="button button--large button--secondary" to="/account">{locale === 'ko' ? '내 계정' : 'My account'}</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="booking-hero">
        <div className="container booking-hero__grid">
          <div>
            <p className="eyebrow">SERVICE REQUEST</p>
            <h1>{locale === 'ko' ? '아는 것부터 순서대로 남겨주세요.' : 'Start with what you know.'}</h1>
            <p>{locale === 'ko' ? '제품, 증상, 희망 일정을 먼저 정리합니다. 제출 전에는 어떤 시간도 확정으로 표시하지 않습니다.' : 'Organize the appliance, symptoms, and preferred time. Nothing is shown as confirmed before submission and operational review.'}</p>
          </div>
          <div className="booking-hero__status"><CatalogStatus /><span>{session?.accessToken ? (locale === 'ko' ? '로그인됨' : 'Signed in') : (locale === 'ko' ? '제출 전 로그인 필요' : 'Sign-in required to submit')}</span></div>
        </div>
      </section>

      <section className="booking-section">
        <form className="container booking-layout" onSubmit={handleSubmit} noValidate={false}>
          <div className="booking-form">
            {catalogSource !== 'live' ? (
              <div className="booking-callout" role="status">
                <AlertCircle aria-hidden="true" />
                <div><strong>{locale === 'ko' ? '현재 미리보기 모드입니다' : 'Preview mode is active'}</strong><p>{locale === 'ko' ? '화면과 입력 흐름은 확인할 수 있지만, 미리보기 ID와 일정으로 실제 예약은 제출되지 않습니다.' : 'You can inspect the interface and draft flow, but preview IDs and dates can never submit a real booking.'}</p></div>
              </div>
            ) : null}

            <fieldset className="form-section">
              <legend><span>01</span><div><strong>{locale === 'ko' ? '서비스 선택' : 'Choose a service'}</strong><small>{locale === 'ko' ? '제품과 작업 범위를 선택하세요.' : 'Select the appliance and scope.'}</small></div></legend>
              <div className="service-choice-grid">
                {catalog.serviceTypes.map((item, index) => {
                  const visual = services.find((service) => serviceTerms(service.slug).some((term) => `${item.key} ${item.label}`.toLowerCase().includes(term))) ?? services[index % services.length];
                  return (
                    <label className={form.serviceTypeId === item.id ? 'is-selected' : ''} key={item.id}>
                      <input type="radio" name="serviceType" value={item.id} checked={form.serviceTypeId === item.id} onChange={() => update('serviceTypeId', item.id)} />
                      <ServiceGlyph name={visual.icon} size={25} />
                      <span>{item.label}</span>
                    </label>
                  );
                })}
              </div>
              <div className="field-grid field-grid--two">
                <label className="field"><span>{locale === 'ko' ? '제품/하위 유형' : 'Appliance subtype'} <b>*</b></span><select required value={form.subtypeId} onChange={(event) => update('subtypeId', event.target.value)}><option value="">{eligibleSubtypes.length ? (locale === 'ko' ? '선택하세요' : 'Select one') : (locale === 'ko' ? '예약 가능한 조합 없음' : 'No bookable combination')}</option>{eligibleSubtypes.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
                <label className="field"><span>{locale === 'ko' ? '서비스 단계' : 'Service tier'} <b>*</b></span><select required value={form.pricingTierId} onChange={(event) => update('pricingTierId', event.target.value)}><option value="">{locale === 'ko' ? '선택하세요' : 'Select one'}</option>{pricingChoices.map((item) => <option value={item.id} key={item.id}>{item.label} · {formatPrice(item.basePrice, locale)}</option>)}</select></label>
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend><span>02</span><div><strong>{locale === 'ko' ? '상황과 방문 정보' : 'Context and visit details'}</strong><small>{locale === 'ko' ? '원인을 추측하지 말고 보이는 증상을 적어주세요.' : 'Describe what you observe without guessing the cause.'}</small></div></legend>
              <div className="field-grid field-grid--two">
                <label className="field"><span>{locale === 'ko' ? '이름' : 'Name'} <b>*</b></span><input required maxLength={120} autoComplete="name" value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
                <label className="field"><span>{locale === 'ko' ? '전화번호' : 'Phone'}</span><input maxLength={50} inputMode="tel" autoComplete="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} /></label>
              </div>
              <div className="field-grid field-grid--address">
                <label className="field"><span>{locale === 'ko' ? '방문 주소' : 'Visit address'}</span><input maxLength={500} autoComplete="street-address" value={form.address} onChange={(event) => update('address', event.target.value)} /></label>
                <label className="field"><span>{locale === 'ko' ? '상세 주소' : 'Address details'}</span><input maxLength={500} value={form.detailAddress} onChange={(event) => update('detailAddress', event.target.value)} /></label>
              </div>
              <label className="field"><span>{locale === 'ko' ? '현재 증상' : 'Current symptoms'}</span><textarea maxLength={2000} rows={5} placeholder={locale === 'ko' ? '언제부터 어떤 증상이 보였는지 적어주세요.' : 'Describe what happened and when you noticed it.'} value={form.symptom} onChange={(event) => update('symptom', event.target.value)} /></label>

              <div className="media-picker">
                <div className="media-picker__heading"><div><Paperclip aria-hidden="true" /><span><strong>{locale === 'ko' ? '사진·영상 첨부' : 'Photos and video'}</strong><small>{locale === 'ko' ? '사진 10MB · 영상 45MB · 전체 6개 (영상/TUS는 서버 파일럿 필요)' : '10 MB images · 45 MB video · 6 total (video/TUS needs the server pilot)'}</small></span></div><button type="button" className="button button--secondary button--small" onClick={() => fileInputRef.current?.click()}><Camera size={17} aria-hidden="true" />{locale === 'ko' ? '파일 선택' : 'Choose files'}</button></div>
                <input ref={fileInputRef} className="visually-hidden" type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" onChange={chooseFiles} />
                {media.length ? <div className="media-list">{media.map((item) => <div key={item.id}><span className="media-list__icon">{item.kind === 'image' ? <FileImage aria-hidden="true" /> : <Film aria-hidden="true" />}</span><span><strong>{item.file.name}</strong><small>{formatFileSize(item.file.size)}</small></span><button type="button" onClick={() => removeMedia(item.id)} aria-label={`${item.file.name} ${locale === 'ko' ? '삭제' : 'remove'}`}><Trash2 size={17} aria-hidden="true" /></button></div>)}</div> : <p className="media-picker__empty">{locale === 'ko' ? '선택한 파일이 없습니다. 첨부는 선택 사항입니다.' : 'No files selected. Attachments are optional.'}</p>}
                {mediaErrors.map((message) => <p className="field-error" key={message}>{message}</p>)}
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend><span>03</span><div><strong>{locale === 'ko' ? '희망 일정' : 'Preferred schedule'}</strong><small>{locale === 'ko' ? '표시된 시간은 확정이 아니라 요청 가능한 시간입니다.' : 'Available means requestable, not yet confirmed.'}</small></div></legend>
              <label className="field field--date"><span>{locale === 'ko' ? '희망 날짜' : 'Preferred date'} <b>*</b></span><input required type="date" min={todayInSeoul()} value={form.date} onChange={(event) => update('date', event.target.value)} /></label>
              <div className="slot-picker" aria-live="polite">
                {!form.date ? <p className="slot-picker__empty"><CalendarDays aria-hidden="true" />{locale === 'ko' ? '먼저 날짜를 선택해 주세요.' : 'Choose a date first.'}</p> : catalogSource !== 'live' ? <p className="slot-picker__empty"><LockKeyhole aria-hidden="true" />{locale === 'ko' ? '실시간 가능 시간은 백엔드 연결 후 표시됩니다.' : 'Live times appear when the backend is connected.'}</p> : availabilityState === 'loading' ? <p className="slot-picker__empty"><LoaderCircle className="spin" aria-hidden="true" />{locale === 'ko' ? '가능 시간을 확인하고 있습니다.' : 'Checking available times.'}</p> : availabilityState === 'error' ? <div className="slot-picker__error"><span>{availabilityError}</span><button type="button" onClick={() => setAvailabilityAttempt((value) => value + 1)}><RotateCw size={16} aria-hidden="true" />{locale === 'ko' ? '다시 확인' : 'Retry'}</button></div> : availability.length ? <div className="slot-grid">{availability.map((slot) => <button type="button" key={slot.time} disabled={!slot.available} className={form.time === slot.time ? 'is-selected' : ''} onClick={() => update('time', slot.time)} aria-pressed={form.time === slot.time}><Clock3 size={15} aria-hidden="true" />{slot.time}</button>)}</div> : <p className="slot-picker__empty"><AlertCircle aria-hidden="true" />{locale === 'ko' ? '이 날짜에 요청 가능한 시간이 없습니다.' : 'No requestable times are available on this date.'}</p>}
              </div>
              <label className="field"><span>{locale === 'ko' ? '추가 메모' : 'Additional notes'}</span><textarea maxLength={2000} rows={3} value={form.memo} onChange={(event) => update('memo', event.target.value)} /></label>
              <label className="consent-row"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>{locale === 'ko' ? '예약 처리에 필요한 개인정보 수집·이용 안내를 확인했습니다. (필수)' : 'I reviewed the collection and use notice for information required to process this request. (Required)'}</span></label>
              <details className="privacy-note"><summary>{locale === 'ko' ? '이 프리뷰의 개인정보 처리 범위' : 'Privacy scope in this preview'}</summary><p>{locale === 'ko' ? '이 체크는 화면 검증용입니다. 실제 배포 전에는 처리 목적, 항목, 보유 기간, 동의 버전과 철회 방법을 사업 정책에 맞춰 확정하고 서버에 동의 기록을 남겨야 합니다.' : 'This control validates the interface only. Before launch, the business must approve purpose, fields, retention, consent version, withdrawal method, and server-side consent records.'}</p></details>
            </fieldset>
          </div>

          <aside className="booking-summary">
            <div className="booking-summary__sticky">
              <p className="eyebrow">REQUEST SUMMARY</p>
              <h2>{locale === 'ko' ? '예약 요청 요약' : 'Booking request summary'}</h2>
              <dl>
                <div><dt>{locale === 'ko' ? '서비스' : 'Service'}</dt><dd>{selectedService?.label ?? '—'}</dd></div>
                <div><dt>{locale === 'ko' ? '희망 일정' : 'Requested time'}</dt><dd>{form.date && form.time ? `${form.date} · ${form.time}` : '—'}</dd></div>
                <div><dt>{locale === 'ko' ? '첨부 자료' : 'Attachments'}</dt><dd>{media.length ? `${media.length}${locale === 'ko' ? '개' : ''}` : '—'}</dd></div>
              </dl>
              <div className="booking-summary__notice"><AlertCircle size={18} aria-hidden="true" /><p>{locale === 'ko' ? '예약 요청 접수와 방문 일정 확정은 서로 다른 상태입니다.' : 'A received request and a confirmed visit are different states.'}</p></div>
              {!session?.accessToken ? <Link className="account-required" to="/account?next=/book"><LockKeyhole size={17} aria-hidden="true" /><span><strong>{locale === 'ko' ? '제출 전 로그인 필요' : 'Sign in before submission'}</strong><small>{locale === 'ko' ? '작성 중인 내용은 이 탭에서 유지됩니다.' : 'Your draft stays in this tab.'}</small></span><ArrowRight size={17} aria-hidden="true" /></Link> : null}
              {submitError ? <p className="form-message form-message--error" role="alert">{submitError}</p> : null}
              <button className="button button--large button--full" type="submit" disabled={submitting || catalogSource !== 'live' || !session?.accessToken}>
                {submitting ? <LoaderCircle className="spin" size={18} aria-hidden="true" /> : <CalendarDays size={18} aria-hidden="true" />}
                {submitting ? (locale === 'ko' ? '예약을 제출하는 중…' : 'Submitting request…') : (locale === 'ko' ? '예약 요청 제출' : 'Submit booking request')}
              </button>
              <p className="booking-summary__footnote">{locale === 'ko' ? '총 가격은 V2 카탈로그와 선택 항목을 기준으로 서버가 계산합니다.' : 'The server calculates the authoritative total from the V2 catalog and selected options.'}</p>
            </div>
          </aside>
        </form>
      </section>
    </>
  );
}
