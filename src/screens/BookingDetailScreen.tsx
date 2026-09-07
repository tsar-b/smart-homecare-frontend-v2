import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { ApiError, customerSafeErrorMessage } from '../api';
import {
  AppHeader,
  AppScreen,
  BookingMediaGallery,
  BookingMediaPicker,
  BookingMediaViewer,
  Button,
  Card,
  PageIntro,
  SectionTitle,
  StateView,
  StatusBadge,
} from '../components';
import type { LocalMediaUploadPresentation } from '../components';
import { useAuth } from '../context/AuthContext';
import type { AppCatalog, BookingAttachment, LocalBookingMedia, ServiceRequest } from '../domain';
import { canRetryBookingAttachmentUpload, uploadBookingAttachment } from '../media';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors, fonts, radius, spacing } from '../theme/tokens';

type DetailRoute = RouteProp<RootStackParamList, 'BookingDetail'>;
type DetailNavigation = NativeStackNavigationProp<RootStackParamList, 'BookingDetail'>;
type IconName = React.ComponentProps<typeof Ionicons>['name'];
const ACCOUNT_MEDIA_LIMIT_MESSAGE =
  '계정의 미디어 저장 용량 한도에 도달했습니다. 삭제할 수 있는 기존 사진이나 동영상을 정리하거나 고객센터에 문의해 주세요.';

interface DetailOption {
  readonly key: string;
  readonly label: string;
  readonly value?: string;
  readonly extraCost?: number;
}

interface DetailView {
  readonly id: string;
  readonly status: string;
  readonly service: string;
  readonly subtype: string | null;
  readonly tier: string | null;
  readonly customerName: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly detailAddress: string | null;
  readonly reservationDate: string | null;
  readonly reservationTime: string | null;
  readonly totalPrice: number | null;
  readonly symptom: string | null;
  readonly memo: string | null;
  readonly options: readonly DetailOption[];
  readonly createdAt: string | null;
}

function userFacingError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'REQUEST_CANCELLED') return '';
    if (error.code === 'BOOKING_NOT_FOUND' || error.status === 404) {
      return '요청하신 예약을 찾을 수 없습니다.';
    }
    if (error.status === 401 || error.status === 403) {
      return '이 예약을 확인할 권한이 없거나 로그인이 만료되었습니다.';
    }
    if (error.code === 'NETWORK_ERROR') return '서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.';
  }
  return customerSafeErrorMessage(
    error,
    '예약 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
  );
}

function cancelErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'REQUEST_CANCELLED') return '';
    if (error.code === 'BOOKING_NOT_CANCELLABLE') {
      return '이미 완료되었거나 취소된 예약은 다시 취소할 수 없습니다.';
    }
    if (error.code === 'BOOKING_NOT_FOUND' || error.status === 404) {
      return '취소할 예약을 찾을 수 없습니다.';
    }
  }
  return customerSafeErrorMessage(error, '예약을 취소하지 못했습니다. 잠시 후 다시 시도해 주세요.');
}

function mediaErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.code === 'REQUEST_CANCELLED') return '';
    if (error.status === 401 || error.status === 403) {
      return '첨부 파일을 확인하거나 변경할 권한이 없거나 로그인이 만료되었습니다.';
    }
    if (error.code === 'ATTACHMENT_UPLOAD_INCOMPLETE') {
      return '업로드가 끝나지 않은 파일입니다. 삭제한 뒤 원본 파일을 다시 선택해 주세요.';
    }
    if (error.code === 'ATTACHMENT_LIMIT_REACHED') {
      return '첨부 파일 한도를 모두 사용했습니다. 방금 삭제한 파일도 임시 업로드 권한이 만료될 때까지 한도에 포함될 수 있습니다(최대 약 27시간). 잠시 후 다시 시도해 주세요.';
    }
    if (error.code === 'USER_MEDIA_LIMIT_REACHED') {
      return ACCOUNT_MEDIA_LIMIT_MESSAGE;
    }
    if (error.code === 'PROJECT_MEDIA_LIMIT_REACHED') {
      return '현재 전체 미디어 저장 용량을 일시적으로 사용할 수 없습니다. 예약은 그대로 저장되어 있으며, 용량이 확보된 후 다시 시도하거나 고객센터에 문의해 주세요.';
    }
    if (error.code === 'BOOKING_MEDIA_PILOT_DISABLED') {
      return '현재 배포 환경에서는 동영상 또는 6MiB를 초과하는 대용량 파일을 업로드할 수 없습니다. 예약은 그대로 저장되어 있습니다. 이 항목을 제거하거나 더 작은 사진으로 교체해 주세요.';
    }
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
    if (error.code === 'BOOKING_MEDIA_LOCKED') {
      return '현재 예약 상태에서는 첨부 파일을 추가하거나 변경할 수 없습니다.';
    }
    if (error.code === 'ATTACHMENT_ALREADY_COMPLETE') {
      return '';
    }
  }
  return customerSafeErrorMessage(error, fallback);
}

function formatPrice(price: number | null): string {
  if (price === null || price < 0) return '가격 문의';
  return `${price.toLocaleString('ko-KR')}원`;
}

function formatDate(date: string | null): string {
  if (!date) return '일정 미정';
  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.format('YYYY년 M월 D일') : date;
}

function requestToDetail(request: ServiceRequest, catalog: AppCatalog | null): DetailView {
  const service = catalog?.serviceTypes.find((item) => item.id === request.serviceTypeId);
  const subtype = catalog?.subtypes.find((item) => item.id === request.subtypeId);
  const tier = catalog?.pricingTiers.find((item) => item.id === request.pricingTierId);
  const optionMap = new Map(catalog?.options.map((item) => [item.id, item]) ?? []);
  const snapshotOptions: readonly DetailOption[] = request.optionSnapshots.map((snapshot) => ({
    key: `${snapshot.optionId}-${snapshot.value}`,
    label: snapshot.label ?? optionMap.get(snapshot.optionId)?.label ?? '선택 옵션',
    value: snapshot.selectedLabel ?? snapshot.value,
    extraCost: snapshot.extraCost,
  }));

  return {
    id: request.id,
    status: request.status,
    service: request.serviceLabel ?? service?.label ?? request.serviceType ?? '홈케어 서비스',
    subtype: subtype?.label ?? request.subtype,
    tier: tier?.label ?? request.tier,
    customerName: request.name || null,
    phone: request.phone,
    address: request.address,
    detailAddress: request.detailAddress,
    reservationDate: request.reservationDate,
    reservationTime: request.reservationTime,
    totalPrice: request.totalPrice,
    symptom: request.symptom,
    memo: request.memo,
    options:
      snapshotOptions.length > 0
        ? snapshotOptions
        : request.optionIds.map((id, index) => {
            const option = optionMap.get(id);
            return {
              key: id || `option-${index}`,
              label: option?.label ?? `선택 옵션 ${index + 1}`,
              extraCost: option?.extraCost,
            };
          }),
    createdAt: request.createdAt,
  };
}

const CANCELLABLE_STATUSES = new Set(['대기', '확정', 'pending', 'confirmed', 'approved']);

type AdminManagedStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

const ADMIN_STATUS_ACTIONS: readonly {
  status: AdminManagedStatus;
  label: string;
  icon: IconName;
  variant: 'secondary' | 'danger';
}[] = [
  { status: 'pending', label: '대기로 변경', icon: 'time-outline', variant: 'secondary' },
  { status: 'confirmed', label: '확정으로 변경', icon: 'checkmark-circle-outline', variant: 'secondary' },
  { status: 'completed', label: '완료로 변경', icon: 'shield-checkmark-outline', variant: 'secondary' },
  { status: 'cancelled', label: '취소 처리', icon: 'close-circle-outline', variant: 'danger' },
];

const ADMIN_STATUS_LABELS: Readonly<Record<AdminManagedStatus, string>> = {
  pending: '대기',
  confirmed: '확정',
  completed: '완료',
  cancelled: '취소',
};

function normalizedAdminStatus(status: string): AdminManagedStatus | null {
  switch (status) {
    case '대기':
    case 'pending':
      return 'pending';
    case '확정':
    case 'confirmed':
    case 'approved':
      return 'confirmed';
    case '완료':
    case 'completed':
      return 'completed';
    case '취소':
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    default:
      return null;
  }
}

function BookingDetailScreen() {
  const navigation = useNavigation<DetailNavigation>();
  const { bookingId, viewMode = 'customer' } = useRoute<DetailRoute>().params;
  const isAdminView = viewMode === 'admin';
  const { api, configurationError } = useAuth();
  const [detail, setDetail] = useState<DetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [adminActionError, setAdminActionError] = useState<string | null>(null);
  const [updatingAdminStatus, setUpdatingAdminStatus] = useState<AdminManagedStatus | null>(null);
  const [attachments, setAttachments] = useState<readonly BookingAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(true);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
  const [localMedia, setLocalMedia] = useState<readonly LocalBookingMedia[]>([]);
  const [localMediaUploadState, setLocalMediaUploadState] = useState<
    Readonly<Record<string, LocalMediaUploadPresentation>>
  >({});
  const [mediaActionError, setMediaActionError] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [completingAttachmentId, setCompletingAttachmentId] = useState<string | null>(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerAttachment, setViewerAttachment] = useState<BookingAttachment | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const uploadControllerRef = useRef<AbortController | null>(null);
  const viewerControllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      uploadControllerRef.current?.abort();
      viewerControllerRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const load = async () => {
      if (!api) {
        setError(configurationError ?? '서버 연결 설정이 필요합니다.');
        setAttachmentsLoading(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setCancelError(null);
      setAdminActionError(null);
      setAttachments([]);
      setAttachmentsLoading(true);
      setAttachmentsError(null);
      setMediaActionError(null);

      try {
        const attachmentApi = isAdminView
          ? api.admin.bookings.attachments
          : api.requests.attachments;
        const attachmentsPromise = attachmentApi
          .list(bookingId, { signal: controller.signal })
          .then((items) => {
            if (active) setAttachments(items);
          })
          .catch((caught) => {
            if (!active) return;
            const message = mediaErrorMessage(
              caught,
              '첨부 파일을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
            );
            if (message) setAttachmentsError(message);
          })
          .finally(() => {
            if (active) setAttachmentsLoading(false);
          });
        const catalogPromise = api.catalog
          .initialize({ signal: controller.signal })
          .then((initialization) => initialization.catalog)
          .catch(() => null);
        const record = isAdminView
          ? await api.admin.bookings.get(bookingId, { signal: controller.signal })
          : await api.requests.detail(bookingId, { signal: controller.signal });
        const catalog = await catalogPromise;
        await attachmentsPromise;
        if (!active) return;
        setDetail(requestToDetail(record, catalog));
      } catch (caught) {
        if (!active) return;
        const message = userFacingError(caught);
        if (message) setError(message);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [api, bookingId, configurationError, isAdminView, reloadKey]);

  const retry = useCallback(() => setReloadKey((value) => value + 1), []);

  const closeViewer = useCallback(() => {
    viewerControllerRef.current?.abort();
    viewerControllerRef.current = null;
    setViewerVisible(false);
    setViewerAttachment(null);
    setViewerUrl(null);
    setViewerError(null);
    setViewerLoading(false);
  }, []);

  const openAttachment = useCallback(
    (attachment: BookingAttachment) => {
      if (!api || attachment.status !== 'ready') return;
      viewerControllerRef.current?.abort();
      const controller = new AbortController();
      viewerControllerRef.current = controller;
      setViewerAttachment(attachment);
      setViewerUrl(null);
      setViewerError(null);
      setViewerLoading(true);
      setViewerVisible(true);

      const attachmentApi = isAdminView
        ? api.admin.bookings.attachments
        : api.requests.attachments;
      void attachmentApi
        .getDownloadUrl(bookingId, attachment.id, { signal: controller.signal })
        .then((download) => {
          if (!controller.signal.aborted) setViewerUrl(download.downloadUrl);
        })
        .catch((caught) => {
          if (controller.signal.aborted) return;
          const message = mediaErrorMessage(
            caught,
            '첨부 파일의 안전한 보기 주소를 만들지 못했습니다. 다시 열어 주세요.',
          );
          if (message) setViewerError(message);
        })
        .finally(() => {
          if (viewerControllerRef.current === controller) {
            viewerControllerRef.current = null;
            setViewerLoading(false);
          }
        });
    },
    [api, bookingId, isAdminView],
  );

  const deleteAttachment = useCallback(
    (attachment: BookingAttachment) => {
      if (
        isAdminView ||
        !api ||
        !detail ||
        !CANCELLABLE_STATUSES.has(detail.status) ||
        deletingAttachmentId ||
        cancelling ||
        uploadingMedia
      ) {
        return;
      }

      Alert.alert(
        '첨부 파일을 삭제할까요?',
        '삭제한 사진이나 동영상은 복구할 수 없습니다.',
        [
          { text: '아니요', style: 'cancel' },
          {
            text: '삭제',
            style: 'destructive',
            onPress: () => {
              setDeletingAttachmentId(attachment.id);
              setMediaActionError(null);
              void api.requests.attachments
                .remove(bookingId, attachment.id)
                .then(() => {
                  setAttachments((current) => current.filter((item) => item.id !== attachment.id));
                  if (viewerAttachment?.id === attachment.id) closeViewer();
                })
                .catch((caught) => {
                  const message = mediaErrorMessage(
                    caught,
                    '첨부 파일을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.',
                  );
                  if (message) setMediaActionError(message);
                })
                .finally(() => setDeletingAttachmentId(null));
            },
          },
        ],
      );
    },
    [
      api,
      bookingId,
      cancelling,
      closeViewer,
      deletingAttachmentId,
      detail,
      isAdminView,
      uploadingMedia,
      viewerAttachment?.id,
    ],
  );

  const completePendingAttachment = useCallback(
    async (attachment: BookingAttachment) => {
      if (
        isAdminView ||
        !api ||
        !detail ||
        attachment.status !== 'pending' ||
        !CANCELLABLE_STATUSES.has(detail.status) ||
        cancelling ||
        completingAttachmentId
      ) {
        return;
      }

      setCompletingAttachmentId(attachment.id);
      setMediaActionError(null);
      try {
        const completed = await api.requests.attachments.complete(bookingId, attachment.id);
        setAttachments((current) =>
          current.map((item) => (item.id === completed.id ? completed : item)),
        );
      } catch (caught) {
        if (caught instanceof ApiError && caught.code === 'ATTACHMENT_ALREADY_COMPLETE') {
          try {
            setAttachments(await api.requests.attachments.list(bookingId));
          } catch (refreshError) {
            const message = mediaErrorMessage(
              refreshError,
              '첨부 파일 상태를 새로 고치지 못했습니다. 잠시 후 다시 시도해 주세요.',
            );
            if (message) setMediaActionError(message);
          }
        } else {
          const message = mediaErrorMessage(
            caught,
            '첨부 파일 처리를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.',
          );
          if (message) setMediaActionError(message);
        }
      } finally {
        setCompletingAttachmentId(null);
      }
    },
    [api, bookingId, cancelling, completingAttachmentId, detail, isAdminView],
  );

  const uploadLocalMedia = useCallback(async () => {
    if (
      isAdminView ||
      !api ||
      !detail ||
      !CANCELLABLE_STATUSES.has(detail.status) ||
      cancelling ||
      uploadingMedia ||
      localMedia.length === 0
    ) {
      return;
    }

    const controller = new AbortController();
    uploadControllerRef.current = controller;
    setUploadingMedia(true);
    setMediaActionError(null);
    let failedUploads = 0;
    let completedUploads = 0;
    let filesToReselect = 0;
    let accountMediaLimitReached = false;

    try {
      for (const item of localMedia) {
        const previousUpload = localMediaUploadState[item.clientAttachmentId];
        if (previousUpload?.retryable === false) {
          failedUploads += 1;
          filesToReselect += 1;
          continue;
        }
        setLocalMediaUploadState((current) => ({
          ...current,
          [item.clientAttachmentId]: {
            ...current[item.clientAttachmentId],
            status: 'uploading',
            progress: 0,
            error: null,
          },
        }));

        try {
          const completed = await uploadBookingAttachment(api, bookingId, item, {
            signal: controller.signal,
            resumeCompletionForAttachmentId: previousUpload?.attachmentId,
            storagePreviouslyUploaded: previousUpload?.storageUploaded,
            onIntentCreated: (intent) => {
              setLocalMediaUploadState((current) => ({
                ...current,
                [item.clientAttachmentId]: {
                  ...current[item.clientAttachmentId],
                  status: 'uploading',
                  attachmentId: intent.attachment.id,
                },
              }));
            },
            onStorageUploaded: (intent) => {
              setLocalMediaUploadState((current) => ({
                ...current,
                [item.clientAttachmentId]: {
                  ...current[item.clientAttachmentId],
                  status: 'uploading',
                  attachmentId: intent.attachment.id,
                  storageUploaded: true,
                },
              }));
            },
            onProgress: (progress) => {
              setLocalMediaUploadState((current) => ({
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

          completedUploads += 1;
          setAttachments((current) => [
            ...current.filter(
              (attachment) => attachment.clientAttachmentId !== completed.clientAttachmentId,
            ),
            completed,
          ]);
          setLocalMedia((current) =>
            current.filter((selected) => selected.clientAttachmentId !== item.clientAttachmentId),
          );
          setLocalMediaUploadState((current) => {
            const next = { ...current };
            delete next[item.clientAttachmentId];
            return next;
          });
        } catch (caught) {
          if (controller.signal.aborted) throw caught;

          if (caught instanceof ApiError && caught.code === 'ATTACHMENT_ALREADY_COMPLETE') {
            const refreshed = await api.requests.attachments.list(bookingId);
            const completed = refreshed.find(
              (attachment) =>
                attachment.clientAttachmentId === item.clientAttachmentId &&
                attachment.status === 'ready',
            );
            if (completed) {
              completedUploads += 1;
              setAttachments(refreshed);
              setLocalMedia((current) =>
                current.filter(
                  (selected) => selected.clientAttachmentId !== item.clientAttachmentId,
                ),
              );
              setLocalMediaUploadState((current) => {
                const next = { ...current };
                delete next[item.clientAttachmentId];
                return next;
              });
              continue;
            }
          }

          failedUploads += 1;
          const retryable = canRetryBookingAttachmentUpload(caught);
          if (caught instanceof ApiError && caught.code === 'USER_MEDIA_LIMIT_REACHED') {
            accountMediaLimitReached = true;
          }
          if (!retryable) filesToReselect += 1;
          const message = mediaErrorMessage(
            caught,
            '첨부 파일을 업로드하지 못했습니다. 다시 시도해 주세요.',
          );
          setLocalMediaUploadState((current) => ({
            ...current,
            [item.clientAttachmentId]: {
              ...current[item.clientAttachmentId],
              status: 'failed',
              progress: 0,
              error: message || '첨부 파일 상태를 확인하지 못했습니다. 다시 시도해 주세요.',
              retryable,
            },
          }));
        }
      }

      if (completedUploads > 0) {
        try {
          setAttachments(await api.requests.attachments.list(bookingId));
        } catch {
          // Completed response data remains usable; a later page reload will
          // refresh thumbnail URLs.
        }
      }
      if (failedUploads > 0) {
        setMediaActionError(
          accountMediaLimitReached
            ? ACCOUNT_MEDIA_LIMIT_MESSAGE
            : filesToReselect > 0
            ? `${filesToReselect}개 파일은 제거한 뒤 원본을 다시 선택해야 합니다.${failedUploads > filesToReselect ? ` 나머지 ${failedUploads - filesToReselect}개는 다시 시도할 수 있습니다.` : ''}`
            : `${failedUploads}개 파일을 업로드하지 못했습니다. 실패한 파일만 다시 시도할 수 있습니다.`,
        );
      }
    } catch (caught) {
      if (!controller.signal.aborted) {
        const message = mediaErrorMessage(
          caught,
          '첨부 파일 업로드를 완료하지 못했습니다. 다시 시도해 주세요.',
        );
        if (message) setMediaActionError(message);
      }
    } finally {
      if (uploadControllerRef.current === controller) uploadControllerRef.current = null;
      setUploadingMedia(false);
    }
  }, [
    api,
    bookingId,
    cancelling,
    detail,
    isAdminView,
    localMedia,
    localMediaUploadState,
    uploadingMedia,
  ]);

  const cancelBooking = useCallback(() => {
    if (
      isAdminView ||
      !api ||
      !detail ||
      cancelling ||
      !CANCELLABLE_STATUSES.has(detail.status)
    ) {
      return;
    }

    Alert.alert(
      '예약을 취소할까요?',
      '예약을 취소하면 선택한 방문 시간이 다시 열릴 수 있습니다.',
      [
        { text: '아니요', style: 'cancel' },
        {
          text: '예약 취소',
          style: 'destructive',
          onPress: () => {
            setCancelling(true);
            setCancelError(null);
            void api.requests
              .cancel(bookingId)
              .then(cancelled => {
                setDetail(current =>
                  current
                    ? {
                        ...current,
                        status: cancelled.status,
                        totalPrice: cancelled.totalPrice,
                      }
                    : current,
                );
              })
              .catch(caught => {
                const message = cancelErrorMessage(caught);
                if (message) setCancelError(message);
              })
              .finally(() => setCancelling(false));
          },
        },
      ],
    );
  }, [api, bookingId, cancelling, detail, isAdminView]);

  const updateAdminStatus = useCallback(
    (nextStatus: AdminManagedStatus) => {
      if (!isAdminView || !api || !detail || updatingAdminStatus) return;
      if (normalizedAdminStatus(detail.status) === nextStatus) return;

      Alert.alert(
        '예약 상태 변경',
        `이 예약을 ${ADMIN_STATUS_LABELS[nextStatus]} 상태로 저장할까요?`,
        [
          { text: '아니요', style: 'cancel' },
          {
            text: '변경',
            onPress: () => {
              setUpdatingAdminStatus(nextStatus);
              setAdminActionError(null);
              void api.admin.bookings
                .updateStatus(bookingId, { status: nextStatus })
                .then(updated => {
                  setDetail(current =>
                    current
                      ? {
                          ...current,
                          status: updated.status,
                          totalPrice: updated.totalPrice,
                        }
                      : current,
                  );
                })
                .catch(caught => {
                  const message = customerSafeErrorMessage(
                    caught,
                    '예약 상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.',
                  );
                  if (message) setAdminActionError(message);
                })
                .finally(() => setUpdatingAdminStatus(null));
            },
          },
        ],
      );
    },
    [api, bookingId, detail, isAdminView, updatingAdminStatus],
  );

  if (loading && !detail) {
    return (
      <AppScreen padded={false}>
        <AppHeader title={isAdminView ? '예약 관리 상세' : '예약 상세'} onBack={() => navigation.goBack()} />
        <StateView title="예약 정보를 불러오는 중입니다" loading />
      </AppScreen>
    );
  }

  if (error || !detail) {
    return (
      <AppScreen padded={false}>
        <AppHeader title={isAdminView ? '예약 관리 상세' : '예약 상세'} onBack={() => navigation.goBack()} />
        <StateView
          title="예약 정보를 확인할 수 없습니다"
          message={error ?? '예약 정보가 존재하지 않습니다.'}
          icon="document-text-outline"
          actionLabel="다시 시도"
          onAction={retry}
        />
      </AppScreen>
    );
  }

  const schedule = `${formatDate(detail.reservationDate)}${detail.reservationTime ? ` ${detail.reservationTime}` : ''}`;
  const fullAddress = [detail.address, detail.detailAddress].filter(Boolean).join(' ');
  const canManageMedia = !isAdminView && CANCELLABLE_STATUSES.has(detail.status);

  return (
    <>
      <AppScreen padded={false} scroll>
        <AppHeader title={isAdminView ? '예약 관리 상세' : '예약 상세'} onBack={() => navigation.goBack()} />
        <View style={styles.content}>
        <PageIntro
          title={detail.service}
          description={
            isAdminView
              ? '고객의 예약 내용과 진행 상태를 확인하고 관리하세요.'
              : '예약 내용과 현재 진행 상태를 확인하세요.'
          }
        />

        <Card style={styles.summaryCard} elevated>
          <View style={styles.summaryHeading}>
            <View style={styles.summaryTitleWrap}>
              <Text style={styles.summaryEyebrow}>예약 번호</Text>
              <Text style={styles.reference} selectable numberOfLines={1}>{detail.id}</Text>
            </View>
            <StatusBadge status={detail.status} />
          </View>
          <View style={styles.priceBlock}>
            <Text style={styles.priceLabel}>서버 확정 금액</Text>
            <Text style={styles.price}>{formatPrice(detail.totalPrice)}</Text>
          </View>
        </Card>

        <Section title="방문 일정">
          <InfoRow icon="calendar-outline" label="예약 일시" value={schedule} />
          {detail.createdAt ? (
            <InfoRow icon="receipt-outline" label="접수 일시" value={formatDate(detail.createdAt)} />
          ) : null}
        </Section>

        <Section title="서비스 정보">
          <InfoRow icon="construct-outline" label="서비스" value={detail.service} />
          {detail.subtype && detail.subtype !== detail.service ? (
            <InfoRow icon="cube-outline" label="기기 유형" value={detail.subtype} />
          ) : null}
          {detail.tier ? <InfoRow icon="layers-outline" label="서비스 등급" value={detail.tier} /> : null}
        </Section>

        {detail.options.length > 0 ? (
          <Section title="선택 옵션">
            {detail.options.map((option) => (
              <View key={option.key} style={styles.optionRow}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <View style={styles.optionCopy}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  {option.value ? <Text style={styles.optionValue}>{option.value}</Text> : null}
                </View>
                {option.extraCost !== undefined ? (
                  <Text style={styles.optionPrice}>
                    {option.extraCost > 0
                      ? `+${option.extraCost.toLocaleString('ko-KR')}원`
                      : '추가 금액 없음'}
                  </Text>
                ) : null}
              </View>
            ))}
          </Section>
        ) : null}

        {(detail.customerName || detail.phone || fullAddress) ? (
          <Section title="예약자 정보">
            {detail.customerName ? <InfoRow icon="person-outline" label="예약자" value={detail.customerName} /> : null}
            {detail.phone ? <InfoRow icon="call-outline" label="연락처" value={detail.phone} selectable /> : null}
            {fullAddress ? <InfoRow icon="location-outline" label="방문 주소" value={fullAddress} selectable /> : null}
          </Section>
        ) : null}

        {detail.symptom ? (
          <Section title="요청 증상">
            <Text style={styles.longText}>{detail.symptom}</Text>
          </Section>
        ) : null}

        {detail.memo ? (
          <Section title="추가 메모">
            <Text style={styles.longText}>{detail.memo}</Text>
          </Section>
        ) : null}

        <Section title="현장 사진 및 동영상">
          {attachmentsLoading ? (
            <View style={styles.mediaLoading} accessibilityRole="progressbar">
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.mediaLoadingText}>첨부 파일을 불러오고 있어요.</Text>
            </View>
          ) : attachmentsError ? (
            <View style={styles.mediaLoadError} accessibilityRole="alert">
              <Ionicons name="cloud-offline-outline" size={21} color={colors.danger} />
              <Text style={styles.mediaLoadErrorText}>{attachmentsError}</Text>
              <Button
                label="다시 불러오기"
                variant="secondary"
                onPress={retry}
                style={styles.mediaRetryButton}
              />
            </View>
          ) : (
            <BookingMediaGallery
              attachments={attachments}
              onOpen={openAttachment}
              onDelete={
                canManageMedia && !uploadingMedia && !cancelling
                  ? deleteAttachment
                  : undefined
              }
              onRetry={
                canManageMedia && !cancelling
                  ? (attachment) => void completePendingAttachment(attachment)
                  : undefined
              }
              deletingId={deletingAttachmentId}
              completingId={completingAttachmentId}
            />
          )}

          {canManageMedia && !attachmentsLoading && !attachmentsError ? (
            <View style={styles.mediaComposer}>
              <BookingMediaPicker
                value={localMedia}
                existingAttachments={attachments}
                onChange={(next) => {
                  const selectedIds = new Set(next.map((item) => item.clientAttachmentId));
                  setLocalMedia(next);
                  setLocalMediaUploadState((current) =>
                    Object.fromEntries(
                      Object.entries(current).filter(([id]) => selectedIds.has(id)),
                    ),
                  );
                  setMediaActionError(null);
                }}
                disabled={
                  uploadingMedia ||
                  cancelling ||
                  deletingAttachmentId !== null ||
                  completingAttachmentId !== null
                }
                uploadState={localMediaUploadState}
                onError={setMediaActionError}
              />
              {localMedia.length > 0 ? (
                <Button
                  label={uploadingMedia ? '첨부 파일 업로드 중' : '선택한 파일 업로드'}
                  icon="cloud-upload-outline"
                  onPress={() => void uploadLocalMedia()}
                  loading={uploadingMedia}
                  disabled={
                    cancelling ||
                    deletingAttachmentId !== null ||
                    completingAttachmentId !== null
                  }
                  style={styles.mediaUploadButton}
                />
              ) : null}
            </View>
          ) : null}
        </Section>

        {mediaActionError ? (
          <View style={styles.cancelError} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.cancelErrorText}>{mediaActionError}</Text>
          </View>
        ) : null}

        {isAdminView ? (
          <Section title="예약 상태 관리">
            <View style={styles.adminStatusActions}>
              {ADMIN_STATUS_ACTIONS.map(action => (
                <Button
                  key={action.status}
                  label={action.label}
                  icon={action.icon}
                  variant={action.variant}
                  disabled={
                    updatingAdminStatus !== null ||
                    normalizedAdminStatus(detail.status) === action.status
                  }
                  loading={updatingAdminStatus === action.status}
                  onPress={() => updateAdminStatus(action.status)}
                  accessibilityHint="관리자 권한으로 예약 상태를 변경합니다"
                />
              ))}
            </View>
          </Section>
        ) : null}

        {adminActionError ? (
          <View style={styles.cancelError} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.cancelErrorText}>{adminActionError}</Text>
          </View>
        ) : null}

        {!isAdminView && cancelError ? (
          <View style={styles.cancelError} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.cancelErrorText}>{cancelError}</Text>
          </View>
        ) : null}

        {!isAdminView && CANCELLABLE_STATUSES.has(detail.status) ? (
          <Button
            label="예약 취소"
            icon="close-circle-outline"
            variant="danger"
            loading={cancelling}
            disabled={
              uploadingMedia ||
              deletingAttachmentId !== null ||
              completingAttachmentId !== null
            }
            onPress={cancelBooking}
            accessibilityHint="확인 후 이 예약을 취소합니다"
            style={styles.cancelButton}
          />
        ) : null}

        <Button label="목록으로 돌아가기" onPress={() => navigation.goBack()} variant="ghost" />
        </View>
      </AppScreen>
      <BookingMediaViewer
        visible={viewerVisible}
        attachment={viewerAttachment}
        url={viewerUrl}
        loading={viewerLoading}
        error={viewerError}
        onRequestClose={closeViewer}
      />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionWrap}>
      <SectionTitle>{title}</SectionTitle>
      <Card style={styles.sectionCard}>{children}</Card>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  selectable = false,
}: {
  icon: IconName;
  label: string;
  value: string;
  selectable?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={19} color={colors.primary} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} selectable={selectable}>{value}</Text>
      </View>
    </View>
  );
}

export default BookingDetailScreen;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  summaryCard: {
    marginBottom: spacing.xl,
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primarySoft,
  },
  summaryHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  summaryTitleWrap: {
    flex: 1,
  },
  summaryEyebrow: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  reference: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  priceBlock: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  priceLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  price: {
    marginTop: spacing.xxs,
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 31,
    color: colors.primaryDark,
  },
  sectionWrap: {
    marginBottom: spacing.xl,
  },
  sectionCard: {
    paddingVertical: spacing.xs,
  },
  infoRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  infoCopy: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  infoLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  infoValue: {
    marginTop: 2,
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  optionRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  optionCopy: {
    flex: 1,
  },
  optionLabel: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.text,
  },
  optionValue: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  optionPrice: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.primaryDark,
  },
  longText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textSecondary,
  },
  mediaLoading: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  mediaLoadingText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  mediaLoadError: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  mediaLoadErrorText: {
    marginTop: spacing.xs,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },
  mediaRetryButton: {
    marginTop: spacing.md,
  },
  mediaComposer: {
    marginTop: spacing.md,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
  },
  mediaUploadButton: {
    marginTop: spacing.md,
  },
  adminStatusActions: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  cancelError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  cancelErrorText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },
  cancelButton: {
    marginBottom: spacing.sm,
  },
});
