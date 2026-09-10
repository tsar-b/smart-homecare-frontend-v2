import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute, usePreventRemove } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Crypto from 'expo-crypto';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError, customerSafeErrorMessage } from '../api';
import {
  AppHeader,
  AppScreen,
  BookingMediaPicker,
  Button,
  Card,
  FormField,
  PageIntro,
  ProgressSteps,
  SectionTitle,
  StateView,
} from '../components';
import type { LocalMediaUploadPresentation } from '../components';
import { useAuth } from '../context/AuthContext';
import type { LocalBookingMedia, ServiceRequest } from '../domain';
import { canRetryBookingAttachmentUpload, uploadBookingAttachment } from '../media';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors, fonts, radius, spacing } from '../theme/tokens';
import { localDateKey, startOfBookingToday as startOfToday, isPastBookingSlot as isPastSlot, formatBookingPrice as formatPrice } from '../utils/bookingTime';

type ConfirmRoute = RouteProp<RootStackParamList, 'Confirm'>;
type ConfirmNavigation = NativeStackNavigationProp<RootStackParamList>;

type Slot = {
  time: string;
  available: boolean;
};

const BOOKING_STEPS = ['가전 선택', '서비스 선택', '제품 종류', '상세 옵션', '일정 확인'];
const PREVIEW_SLOTS: Slot[] = [
  { time: '09:00', available: true },
  { time: '10:30', available: true },
  { time: '13:00', available: false },
  { time: '14:30', available: true },
  { time: '16:00', available: true },
];
const ACCOUNT_MEDIA_LIMIT_MESSAGE =
  '계정의 미디어 저장 용량 한도에 도달했습니다. 삭제할 수 있는 기존 사진이나 동영상을 정리하거나 고객센터에 문의해 주세요.';

function maxReservationDate(): Date {
  const date = startOfToday();
  date.setDate(date.getDate() + 90);
  return date;
}

function formatKoreanDate(value: Date): string {
  return value.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function submitErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'BOOKING_SLOT_UNAVAILABLE') {
      return '방금 다른 고객이 이 시간을 선택했습니다. 다른 시간을 골라 주세요.';
    }
    if (error.code === 'BOOKING_SLOT_IN_PAST') {
      return '선택한 시간이 이미 지났습니다. 다른 시간을 골라 주세요.';
    }
    if (error.code === 'BOOKING_SLOT_NOT_CONFIGURED') {
      return '현재 접수할 수 없는 시간입니다. 예약 가능 시간을 다시 선택해 주세요.';
    }
    if (error.code === 'DUPLICATE_BOOKING') {
      return '같은 예약이 이미 접수되었습니다. 예약 내역을 확인해 주세요.';
    }
    if (error.code === 'IDEMPOTENCY_IN_PROGRESS') {
      return '동일한 예약을 처리하고 있습니다. 잠시 후 예약 내역을 확인해 주세요.';
    }
    if (error.code === 'IDEMPOTENCY_CONFLICT') {
      return '예약 내용이 변경되었습니다. 다시 확인한 뒤 접수해 주세요.';
    }
    if (error.code === 'NETWORK_ERROR') {
      return '서버에 연결하지 못했습니다. 다시 시도해도 중복 예약은 생성되지 않습니다.';
    }
    return customerSafeErrorMessage(error, '예약을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
  return customerSafeErrorMessage(error, '예약을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.');
}

function availabilityErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'AVAILABILITY_FAILED') {
    return '예약 가능 시간을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }
  return customerSafeErrorMessage(error, '예약 가능 시간을 불러오지 못했습니다.');
}

function attachmentUploadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'ATTACHMENT_VALIDATION_FAILED' || error.code === 'MEDIA_TYPE_INVALID') {
      return '파일 내용과 형식이 일치하지 않습니다. 이 항목을 제거한 뒤 원본 파일을 다시 선택해 주세요.';
    }
    if (
      error.code === 'ATTACHMENT_IDEMPOTENCY_CONFLICT' ||
      error.code === 'ATTACHMENT_NOT_UPLOADABLE' ||
      error.code === 'ATTACHMENT_NOT_COMPLETABLE'
    ) {
      return '이 첨부 항목은 더 이상 업로드할 수 없습니다. 제거한 뒤 원본 파일을 다시 선택해 주세요.';
    }
    if (error.code === 'ATTACHMENT_LIMIT_REACHED') {
      return '첨부 파일 한도를 모두 사용했습니다. 최근 삭제한 파일도 임시 업로드 권한이 만료될 때까지 한도에 포함될 수 있습니다(최대 약 27시간).';
    }
    if (error.code === 'USER_MEDIA_LIMIT_REACHED') {
      return ACCOUNT_MEDIA_LIMIT_MESSAGE;
    }
    if (error.code === 'PROJECT_MEDIA_LIMIT_REACHED') {
      return '현재 전체 미디어 저장 용량을 일시적으로 사용할 수 없습니다. 예약은 정상적으로 저장되었으며, 용량이 확보된 후 다시 시도하거나 고객센터에 문의해 주세요.';
    }
    if (error.code === 'BOOKING_MEDIA_PILOT_DISABLED') {
      return '현재 배포 환경에서는 동영상 또는 6MiB를 초과하는 대용량 파일을 업로드할 수 없습니다. 예약은 정상적으로 저장되었습니다. 이 항목을 제거하거나 더 작은 사진으로 교체해 주세요.';
    }
    if (error.code === 'BOOKING_MEDIA_LOCKED') {
      return '현재 예약 상태에서는 첨부 파일을 추가할 수 없습니다.';
    }
  }
  return customerSafeErrorMessage(error, '업로드하지 못했습니다. 다시 시도해 주세요.');
}

export default function BookingConfirm() {
  const navigation = useNavigation<ConfirmNavigation>();
  const route = useRoute<ConfirmRoute>();
  const {
    subtype,
    serviceType,
    tier,
    selectedOptions,
    symptom: initialSymptom = '',
    isPreview = false,
  } = route.params;
  const { api, token, currentUser, configurationError } = useAuth();
  const previewMode = isPreview || (!api && Boolean(configurationError));

  const [reservationDate, setReservationDate] = useState(startOfToday);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [symptom, setSymptom] = useState(initialSymptom);
  const [availableSlots, setAvailableSlots] = useState<readonly Slot[]>(
    previewMode ? PREVIEW_SLOTS : [],
  );
  const [availabilityLoading, setAvailabilityLoading] = useState(Boolean(api) && !previewMode);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityReloadKey, setAvailabilityReloadKey] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [clockTick, setClockTick] = useState(0);
  const [media, setMedia] = useState<readonly LocalBookingMedia[]>([]);
  const [mediaUploadState, setMediaUploadState] = useState<
    Readonly<Record<string, LocalMediaUploadPresentation>>
  >({});
  const [createdBooking, setCreatedBooking] = useState<ServiceRequest | null>(null);
  const uploadControllerRef = useRef<AbortController | null>(null);
  const submissionRef = useRef<{ fingerprint: string; id: string } | null>(null);

  const dateKey = localDateKey(reservationDate);

  // Android reopens/updates its native dialog when this callback changes.
  // Keep it stable across clock ticks and availability/upload state updates,
  // so a date the customer is still choosing is not reset to the saved value.
  const handleReservationDateChange = useCallback((event: DateTimePickerEvent, date?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (event.type === 'set' && date) {
      setReservationDate(current => localDateKey(date) !== localDateKey(current) ? date : current);
    }
  }, []);

  useEffect(() => () => uploadControllerRef.current?.abort(), []);
  usePreventRemove(isSubmitting && Boolean(token), () => {
    Alert.alert('예약 처리 중', '접수 결과와 첨부 파일 처리가 끝날 때까지 잠시 기다려 주세요.');
  });
  useEffect(() => {
    if (previewMode || createdBooking) return;
    const timer = setInterval(() => setClockTick(value => value + 1), 30_000);
    return () => clearInterval(timer);
  }, [previewMode, createdBooking]);
  useEffect(() => {
    if (!previewMode && !createdBooking && selectedSlot && isPastSlot(reservationDate, selectedSlot)) {
      setSelectedSlot(null);
    }
  }, [clockTick, previewMode, createdBooking, reservationDate, selectedSlot]);

  useEffect(() => {
    setSelectedSlot(null);
    setSubmitError(null);
  }, [dateKey]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    if (previewMode) {
      setAvailableSlots(PREVIEW_SLOTS);
      setAvailabilityError(null);
      setAvailabilityLoading(false);
      return () => controller.abort();
    }

    if (!api) {
      setAvailableSlots([]);
      setSelectedSlot(null);
      setAvailabilityError(configurationError ?? '서버 연결 설정이 필요합니다.');
      setAvailabilityLoading(false);
      return () => controller.abort();
    }

    setAvailabilityLoading(true);
    setAvailabilityError(null);

    void api.requests
      .availability(dateKey, { signal: controller.signal })
      .then(slots => {
        if (!active) return;
        const sorted = [...slots].sort((left, right) => left.time.localeCompare(right.time));
        setAvailableSlots(sorted);
        setSelectedSlot(current =>
          current &&
          sorted.some(
            slot =>
              slot.time === current &&
              slot.available &&
              !isPastSlot(reservationDate, slot.time),
          )
            ? current
            : null,
        );
      })
      .catch(error => {
        if (!active || (error instanceof ApiError && error.code === 'REQUEST_CANCELLED')) return;
        setAvailableSlots([]);
        setSelectedSlot(null);
        setAvailabilityError(availabilityErrorMessage(error));
      })
      .finally(() => {
        if (active) setAvailabilityLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [api, availabilityReloadKey, configurationError, dateKey, previewMode, reservationDate]);

  const localEstimate = useMemo(() => {
    if (previewMode || tier.price === -1) return null;
    return tier.price + selectedOptions.reduce((sum, item) => sum + item.extraCost, 0);
  }, [previewMode, selectedOptions, tier.price]);

  const canonicalSelection = useMemo(
    () => ({
      categoryId: typeof subtype.category === 'object' ? subtype.category._id : subtype.category,
      serviceTypeId: serviceType._id,
      subtypeId: subtype._id,
      pricingTierId: tier.id ?? tier._id,
      selectedOptions: selectedOptions.map(option => ({
        optionId: option._id,
        value: option.selectedValue,
      })),
    }),
    [selectedOptions, serviceType._id, subtype._id, subtype.category, tier._id, tier.id],
  );

  const handleSubmit = async () => {
    if (submittingRef.current) return;

    if (previewMode) {
      setSubmitError(
        '디자인 미리보기에서는 예약을 접수할 수 없습니다. API 연결 후 실제 서비스 정보로 다시 진행해 주세요.',
      );
      return;
    }

    if (!api || !token) {
      setSubmitError(
        configurationError
          ? '현재는 디자인 미리보기입니다. API 주소를 연결하면 실제 예약을 접수할 수 있습니다.'
          : '예약하려면 로그인하거나 비회원 정보를 등록해 주세요.',
      );
      return;
    }
    if (!createdBooking && !currentUser?.name) {
      setSubmitError('예약자 정보를 불러오지 못했습니다. 설정에서 프로필을 확인해 주세요.');
      return;
    }
    const { serviceTypeId, subtypeId, pricingTierId } = canonicalSelection;
    if (!createdBooking && (!serviceTypeId || !subtypeId || !pricingTierId)) {
      setSubmitError(
        '서버에서 확인할 수 있는 서비스 선택 정보가 부족합니다. 서비스를 다시 선택해 주세요.',
      );
      return;
    }
    if (!createdBooking && !selectedSlot) {
      setSubmitError('방문 시간을 선택해 주세요.');
      return;
    }
    if (!createdBooking && (availabilityLoading || availabilityError ||
      !availableSlots.some(slot => slot.time === selectedSlot && slot.available) ||
      isPastSlot(reservationDate, selectedSlot!))) {
      setSelectedSlot(null);
      setSubmitError('선택한 시간에 접수할 수 없습니다. 예약 가능 시간을 다시 확인해 주세요.');
      setAvailabilityReloadKey(value => value + 1);
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    const controller = new AbortController();
    uploadControllerRef.current = controller;
    try {
      let created = createdBooking;
      if (!created) {
        const details = {
          ...canonicalSelection,
          serviceTypeId: serviceTypeId!,
          subtypeId: subtypeId!,
          pricingTierId: pricingTierId!,
          name: currentUser!.name!,
          phone: currentUser!.phone ?? undefined,
          address: currentUser!.address ?? undefined,
          detailAddress: currentUser!.addressDetail ?? undefined,
          symptom: serviceType.name === 'fix' ? symptom.trim() || undefined : undefined,
          reservationDate: dateKey,
          reservationTime: selectedSlot!,
          timezone: 'Asia/Seoul',
        };
        const fingerprint = JSON.stringify(details);
        if (!submissionRef.current || submissionRef.current.fingerprint !== fingerprint) {
          submissionRef.current = { fingerprint, id: Crypto.randomUUID() };
        }
        const idempotencyKey = submissionRef.current.id;
        created = await api.requests.create(
          {
            ...details,
            clientRequestId: idempotencyKey,
          },
          { idempotencyKey, signal: controller.signal },
        );
        setCreatedBooking(created);
        setShowPicker(false);
      }

      let failedUploads = 0;
      let filesToReselect = 0;
      let accountMediaLimitReached = false;
      for (const item of media) {
        const previousUpload = mediaUploadState[item.clientAttachmentId];
        if (previousUpload?.status === 'uploaded') continue;
        if (previousUpload?.retryable === false) {
          failedUploads += 1;
          filesToReselect += 1;
          continue;
        }
        setMediaUploadState(current => ({
          ...current,
          [item.clientAttachmentId]: {
            ...current[item.clientAttachmentId],
            status: 'uploading',
            progress: 0,
            error: null,
          },
        }));
        try {
          const uploaded = await uploadBookingAttachment(api, created.id, item, {
            signal: controller.signal,
            resumeCompletionForAttachmentId: previousUpload?.attachmentId,
            storagePreviouslyUploaded: previousUpload?.storageUploaded,
            onIntentCreated: intent => {
              setMediaUploadState(current => ({
                ...current,
                [item.clientAttachmentId]: {
                  ...current[item.clientAttachmentId],
                  status: 'uploading',
                  attachmentId: intent.attachment.id,
                },
              }));
            },
            onStorageUploaded: intent => {
              setMediaUploadState(current => ({
                ...current,
                [item.clientAttachmentId]: {
                  ...current[item.clientAttachmentId],
                  status: 'uploading',
                  attachmentId: intent.attachment.id,
                  storageUploaded: true,
                },
              }));
            },
            onProgress: progress => {
              setMediaUploadState(current => ({
                ...current,
                [item.clientAttachmentId]: {
                  ...current[item.clientAttachmentId],
                  status: 'uploading',
                  progress: progress.progress,
                  error: null,
                },
              }));
            },
          });
          setMediaUploadState(current => ({
            ...current,
            [item.clientAttachmentId]: {
              ...current[item.clientAttachmentId],
              status: 'uploaded',
              progress: 1,
              error: null,
              attachmentId: uploaded.id,
              storageUploaded: true,
            },
          }));
        } catch (error) {
          if (controller.signal.aborted) throw error;
          failedUploads += 1;
          const message = attachmentUploadErrorMessage(error);
          const retryable = canRetryBookingAttachmentUpload(error);
          if (error instanceof ApiError && error.code === 'USER_MEDIA_LIMIT_REACHED') {
            accountMediaLimitReached = true;
          }
          if (!retryable) filesToReselect += 1;
          setMediaUploadState(current => ({
            ...current,
            [item.clientAttachmentId]: {
              ...current[item.clientAttachmentId],
              status: 'failed',
              progress: 0,
              error: message,
              retryable,
            },
          }));
        }
      }

      if (failedUploads > 0) {
        setSubmitError(
          accountMediaLimitReached
            ? `예약은 정상적으로 저장되었습니다. ${ACCOUNT_MEDIA_LIMIT_MESSAGE}`
            : filesToReselect > 0
            ? `예약은 정상적으로 저장되었습니다. 첨부 파일 ${filesToReselect}개는 제거한 뒤 원본을 다시 선택해야 합니다.${failedUploads > filesToReselect ? ` 나머지 ${failedUploads - filesToReselect}개는 아래 버튼으로 다시 시도할 수 있습니다.` : ''}`
            : `예약은 정상적으로 저장되었지만 첨부 파일 ${failedUploads}개를 업로드하지 못했습니다. 아래 버튼으로 실패한 파일만 다시 시도할 수 있습니다.`,
        );
        return;
      }

      submissionRef.current = null;
      Alert.alert(
        '예약 접수 완료',
        `${created.totalPrice === -1 ? '요금은 상담 후 안내됩니다.' : `서버에서 계산한 금액은 ${formatPrice(created.totalPrice)}입니다.`}${media.length > 0 ? ` 첨부 파일 ${media.length}개도 안전하게 저장했습니다.` : ''}`,
        [
          {
            text: '예약 상세 보기',
            onPress: () =>
              navigation.reset({
                index: 1,
                routes: [
                  { name: 'History' },
                  { name: 'BookingDetail', params: { bookingId: created.id } },
                ],
              }),
          },
        ],
      );
    } catch (error) {
      setSubmitError(submitErrorMessage(error));
      if (
        error instanceof ApiError &&
        [
          'BOOKING_SLOT_UNAVAILABLE',
          'BOOKING_SLOT_IN_PAST',
          'BOOKING_SLOT_NOT_CONFIGURED',
        ].includes(error.code)
      ) {
        setSelectedSlot(null);
        setAvailabilityReloadKey(value => value + 1);
      }
    } finally {
      if (uploadControllerRef.current === controller) uploadControllerRef.current = null;
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <AppScreen scroll padded={false}>
      <AppHeader title="예약 확인" onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <ProgressSteps steps={BOOKING_STEPS} current={4} />
        <PageIntro
          title={previewMode ? '일정 화면을 미리 확인하세요' : '방문 일정을 선택해 주세요'}
          description={
            previewMode
              ? '날짜와 시간 선택 동작을 살펴볼 수 있지만 실제 예약 가능 여부를 나타내지 않습니다.'
              : '서비스 내용과 연락처를 확인한 뒤 한 번만 접수됩니다.'
          }
        />

        {previewMode ? (
          <View style={styles.previewNotice} accessibilityRole="summary">
            <Ionicons name="eye-outline" size={20} color={colors.primary} />
            <View style={styles.previewCopy}>
              <Text style={styles.previewTitle}>디자인 미리보기 · 접수 불가</Text>
              <Text style={styles.previewText}>
                표시된 날짜와 시간은 인터페이스 확인용 예시이며 실제 예약 가능 시간이 아닙니다.
                고객 정보나 예약 요청은 서버로 전송되지 않습니다.
              </Text>
            </View>
          </View>
        ) : null}

        {createdBooking ? (
          <View style={styles.savedNotice} accessibilityRole="summary">
            <Ionicons name="checkmark-circle" size={21} color={colors.success} />
            <View style={styles.previewCopy}>
              <Text style={styles.savedTitle}>예약 내용은 이미 안전하게 접수되었습니다</Text>
              <Text style={styles.savedText}>
                아래 날짜·시간·요청 내용은 접수 당시 값으로 잠겼습니다. 첨부 파일만 추가하거나 실패한 업로드를 다시 시도할 수 있습니다.
              </Text>
            </View>
          </View>
        ) : null}

        <Card style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryIcon}>
              <Ionicons name="document-text-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.summaryTitleWrap}>
              <Text style={styles.summaryTitle}>{subtype.name}</Text>
              <Text style={styles.summarySubtitle}>
                {serviceType.label} · {tier.tier.toUpperCase()}
              </Text>
            </View>
          </View>

          {selectedOptions.length > 0 ? (
            <View style={styles.summarySection}>
              {selectedOptions.map(option => (
                <View key={`${option.key}-${option.selectedValue}`} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{option.label}</Text>
                  <Text style={styles.detailValue}>{option.selectedLabel}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>
                {previewMode ? '미리보기 견적' : '예상 금액'}
              </Text>
              <Text style={styles.priceHint}>
                {previewMode ? '실제 가격 데이터 아님' : '서버 계산 후 최종 확정'}
              </Text>
            </View>
            <Text style={styles.priceValue}>
              {localEstimate === null ? '상담 필요' : formatPrice(localEstimate)}
            </Text>
          </View>
        </Card>

        {serviceType.name === 'fix' ? (
          <Card style={styles.symptomCard}>
            <FormField
              label="고장 증상"
              value={symptom}
              onChangeText={setSymptom}
              placeholder="증상을 자세히 적어 주세요."
              multiline
              maxLength={2000}
              editable={!createdBooking && !isSubmitting}
            />
          </Card>
        ) : null}

        <Card style={styles.mediaCard}>
          <BookingMediaPicker
            value={media}
            onChange={next => {
              const selectedIds = new Set(next.map((item) => item.clientAttachmentId));
              setMedia(next);
              setMediaUploadState((current) =>
                Object.fromEntries(
                  Object.entries(current).filter(([id]) => selectedIds.has(id)),
                ),
              );
              setSubmitError(null);
            }}
            disabled={isSubmitting}
            preview={previewMode}
            uploadState={mediaUploadState}
            onError={setSubmitError}
          />
        </Card>

        <View style={styles.section}>
          <SectionTitle>방문 날짜</SectionTitle>
          <Pressable
            onPress={() => setShowPicker(true)}
            disabled={Boolean(createdBooking) || isSubmitting}
            accessibilityRole="button"
            accessibilityLabel={`방문 날짜, ${formatKoreanDate(reservationDate)}`}
            accessibilityHint="날짜 선택기를 엽니다"
            accessibilityState={{ disabled: Boolean(createdBooking) || isSubmitting }}
            style={({ pressed }) => [
              styles.dateButton,
              (createdBooking || isSubmitting) && styles.inputLocked,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.dateIcon}>
              <Ionicons name="calendar-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.dateCopy}>
              <Text style={styles.dateEyebrow}>선택한 날짜</Text>
              <Text style={styles.dateText}>{formatKoreanDate(reservationDate)}</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
          </Pressable>

          {showPicker ? (
            <DateTimePicker
              value={reservationDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={startOfToday()}
              maximumDate={maxReservationDate()}
              onChange={handleReservationDateChange}
            />
          ) : null}
          {showPicker && Platform.OS === 'ios' ? (
            <Button
              label="날짜 선택 완료"
              variant="secondary"
              onPress={() => setShowPicker(false)}
              style={styles.pickerDone}
            />
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.slotHeading}>
            <SectionTitle>방문 시간</SectionTitle>
            {previewMode ? (
              <View style={styles.previewBadge}>
                <Text style={styles.previewBadgeText}>예시 시간</Text>
              </View>
            ) : null}
          </View>

          {availabilityLoading ? (
            <StateView loading title="예약 가능 시간을 확인하고 있어요" />
          ) : availabilityError ? (
            <StateView
              icon="cloud-offline-outline"
              title="시간 정보를 불러오지 못했어요"
              message={availabilityError}
              actionLabel="다시 시도"
              onAction={() => setAvailabilityReloadKey(value => value + 1)}
            />
          ) : availableSlots.length === 0 ? (
            <StateView
              icon="calendar-clear-outline"
              title="선택 가능한 시간이 없어요"
              message="다른 날짜를 선택해 주세요."
            />
          ) : (
            <View style={styles.slotGrid} accessibilityRole="radiogroup">
              {availableSlots.map(slot => {
                const disabled =
                  Boolean(createdBooking) ||
                  isSubmitting ||
                  !slot.available ||
                  (!previewMode && isPastSlot(reservationDate, slot.time));
                const selected = selectedSlot === slot.time;
                return (
                  <Pressable
                    key={slot.time}
                    onPress={() => {
                      setSelectedSlot(slot.time);
                      setSubmitError(null);
                    }}
                    disabled={disabled}
                    accessibilityRole="radio"
                    accessibilityLabel={`${slot.time}${previewMode ? ', 미리보기 예시' : ''}`}
                    accessibilityState={{ checked: selected, disabled }}
                    style={({ pressed }) => [
                      styles.slot,
                      selected && styles.slotSelected,
                      disabled && styles.slotDisabled,
                      pressed && !disabled && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.slotText,
                        selected && styles.slotTextSelected,
                        disabled && styles.slotTextDisabled,
                      ]}
                    >
                      {slot.time}
                    </Text>
                    {disabled ? (
                      <Text style={styles.slotUnavailable}>
                        {previewMode ? '비활성 예시' : '예약 불가'}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <Card style={styles.customerCard}>
          <View style={styles.customerHeading}>
            <Ionicons name="person-circle-outline" size={24} color={colors.primary} />
            <Text style={styles.customerTitle}>예약자 정보</Text>
          </View>
          {currentUser ? (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>이름</Text>
                <Text style={styles.detailValue}>{currentUser.name || '미입력'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>연락처</Text>
                <Text style={styles.detailValue}>{currentUser.phone || '미입력'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>방문 주소</Text>
                <Text style={styles.detailValue} numberOfLines={2}>
                  {[currentUser.address, currentUser.addressDetail].filter(Boolean).join(' ') ||
                    '미입력'}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.missingCustomer}>
              {previewMode
                ? '미리보기에서는 고객 정보를 불러오거나 전송하지 않습니다.'
                : '실제 예약을 접수하려면 로그인하거나 비회원 정보를 등록해야 합니다.'}
            </Text>
          )}
        </Card>

        {submitError ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{submitError}</Text>
          </View>
        ) : null}

        <Button
          label={
            previewMode
              ? '디자인 미리보기 · 접수 불가'
              : createdBooking
                ? '첨부 파일 업로드 계속하기'
                : '예약 접수'
          }
          icon={createdBooking ? 'cloud-upload-outline' : 'checkmark-circle-outline'}
          onPress={() => void handleSubmit()}
          loading={isSubmitting}
          disabled={(!createdBooking && (availabilityLoading || Boolean(availabilityError))) || previewMode || Boolean(configurationError)}
          style={styles.submit}
        />
        <Text style={styles.submitNote}>
          {previewMode
            ? 'API 연결 후 실제 카탈로그와 예약 가능 시간을 불러오면 접수 기능이 활성화됩니다.'
            : createdBooking
              ? '이미 접수된 예약은 다시 만들지 않고, 완료되지 않은 첨부 파일만 업로드합니다.'
              : '접수 버튼을 다시 눌러도 같은 요청이 중복 생성되지 않도록 보호됩니다.'}
        </Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  previewNotice: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.primarySoft,
    borderRadius: radius.md,
    backgroundColor: colors.primarySubtle,
  },
  previewCopy: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  previewTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.primaryDark,
  },
  previewText: {
    marginTop: spacing.xxs,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  savedNotice: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
  },
  savedTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.success,
  },
  savedText: {
    marginTop: spacing.xxs,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  inputLocked: {
    opacity: 0.62,
  },
  summaryCard: {
    padding: spacing.xl,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  summaryTitleWrap: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  summaryTitle: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 23,
    color: colors.text,
  },
  summarySubtitle: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  summarySection: {
    marginTop: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
  },
  detailRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  detailLabel: {
    flexShrink: 0,
    marginRight: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
  },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 20,
    color: colors.text,
  },
  priceRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  priceLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
  },
  priceHint: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
  },
  priceValue: {
    marginLeft: spacing.md,
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.primaryDark,
  },
  symptomCard: {
    marginTop: spacing.md,
  },
  mediaCard: {
    marginTop: spacing.md,
  },
  section: {
    marginTop: spacing.xl,
  },
  dateButton: {
    minHeight: 70,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  dateIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: colors.primarySoft,
  },
  dateCopy: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  dateEyebrow: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
  },
  dateText: {
    marginTop: 2,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  pickerDone: {
    marginTop: spacing.sm,
  },
  slotHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  previewBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.warningSoft,
  },
  previewBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.warning,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xxs,
  },
  slot: {
    minWidth: 96,
    minHeight: 58,
    margin: spacing.xxs,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  slotSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  slotDisabled: {
    borderColor: colors.borderSoft,
    backgroundColor: colors.disabledSoft,
  },
  slotText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
  },
  slotTextSelected: {
    color: colors.white,
  },
  slotTextDisabled: {
    color: colors.disabled,
  },
  slotUnavailable: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.disabled,
  },
  customerCard: {
    marginTop: spacing.xl,
  },
  customerHeading: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerTitle: {
    marginLeft: spacing.xs,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  missingCustomer: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  errorBox: {
    marginTop: spacing.md,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
  },
  errorText: {
    flex: 1,
    marginLeft: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },
  submit: {
    marginTop: spacing.lg,
  },
  submitNote: {
    marginTop: spacing.xs,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.76,
  },
});
