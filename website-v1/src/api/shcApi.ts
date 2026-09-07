import { Upload } from 'tus-js-client';

import type {
  AccountUser,
  AppCatalog,
  AppInitialization,
  AuthSession,
  BookingAttachment,
  BookingAttachmentUploadIntent,
  BookingPayload,
  CreatedBooking,
  SelectedBookingMedia,
} from '../types';

type UnknownRecord = Record<string, unknown>;

const configuredMode = (import.meta.env.VITE_API_MODE ?? 'auto').trim().toLowerCase();
export const apiMode = configuredMode === 'live' || configuredMode === 'preview' ? configuredMode : 'auto';

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5050').trim();
export const apiBaseUrl = configuredBaseUrl.replace(/\/+$/, '');

export class ShcApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 0, code = 'NETWORK_ERROR', options?: ErrorOptions) {
    super(message, options);
    this.name = 'ShcApiError';
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function record(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function arrayValue(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function first(row: UnknownRecord, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
  }
  return undefined;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return response.text();
  return response.json();
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string | null,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    throw new ShcApiError('Smart HomeCare API에 연결할 수 없습니다.', 0, 'NETWORK_ERROR', {
      cause: error,
    });
  }

  const body = await readResponseBody(response);
  if (!response.ok) {
    const payload = record(body);
    throw new ShcApiError(
      stringValue(payload.message, `요청을 완료하지 못했습니다. (${response.status})`),
      response.status,
      stringValue(payload.code, 'HTTP_ERROR'),
    );
  }
  return body as T;
}

function adaptCatalog(value: unknown): AppCatalog {
  const data = record(value);
  return {
    categories: arrayValue(data.categories).map((item) => {
      const row = record(item);
      return {
        id: stringValue(row.id),
        key: stringValue(row.key),
        label: stringValue(row.label),
        sortOrder: numberValue(first(row, 'sortOrder', 'sort_order')),
      };
    }),
    serviceTypes: arrayValue(first(data, 'serviceTypes', 'service_types')).map((item) => {
      const row = record(item);
      return {
        id: stringValue(row.id),
        categoryId: nullableString(first(row, 'categoryId', 'category_id')),
        key: stringValue(row.key),
        label: stringValue(row.label),
        sortOrder: numberValue(first(row, 'sortOrder', 'sort_order')),
      };
    }),
    subtypes: arrayValue(data.subtypes).map((item) => {
      const row = record(item);
      return {
        id: stringValue(row.id),
        key: stringValue(row.key),
        label: stringValue(row.label),
        category: nullableString(row.category),
      };
    }),
    pricingTiers: arrayValue(first(data, 'pricingTiers', 'pricing_tiers')).map((item) => {
      const row = record(item);
      return {
        id: stringValue(row.id),
        serviceTypeId: nullableString(first(row, 'serviceTypeId', 'service_type_id')),
        serviceType: nullableString(first(row, 'serviceType', 'service_type')),
        subtype: nullableString(row.subtype),
        key: stringValue(row.key),
        label: stringValue(row.label),
        basePrice: numberValue(first(row, 'basePrice', 'base_price')),
        sortOrder: numberValue(first(row, 'sortOrder', 'sort_order')),
        memo: nullableString(row.memo),
      };
    }),
    options: arrayValue(data.options).map((item) => {
      const row = record(item);
      return {
        id: stringValue(row.id),
        serviceTypeId: nullableString(first(row, 'serviceTypeId', 'service_type_id')),
        key: stringValue(row.key),
        label: stringValue(row.label),
        extraCost: numberValue(first(row, 'extraCost', 'extra_cost')),
      };
    }),
  };
}

export async function fetchInitialization(signal?: AbortSignal): Promise<AppInitialization> {
  const payload = record(await request<unknown>('/api/app/initialize', { signal }));
  return {
    version: stringValue(payload.version, 'unknown'),
    catalog: adaptCatalog(payload.catalog),
    settings: {
      timezone: stringValue(record(payload.settings).timezone, 'Asia/Seoul'),
      currency: stringValue(record(payload.settings).currency, 'KRW'),
    },
    localization: {
      defaultLocale: stringValue(record(payload.localization).defaultLocale, 'ko'),
      supportedLocales: arrayValue(record(payload.localization).supportedLocales).filter(
        (item): item is string => typeof item === 'string',
      ),
    },
  };
}

function adaptUser(value: unknown): AccountUser | null {
  const row = record(value);
  const id = stringValue(row.id);
  if (!id) return null;
  return {
    id,
    name: nullableString(row.name),
    email: nullableString(row.email),
  };
}

function adaptSession(value: unknown): AuthSession {
  const row = record(value);
  return {
    accessToken: nullableString(first(row, 'accessToken', 'access_token', 'token')),
    refreshToken: nullableString(first(row, 'refreshToken', 'refresh_token')),
    requiresEmailConfirmation: Boolean(
      first(row, 'requiresEmailConfirmation', 'requires_email_confirmation'),
    ),
    user: adaptUser(row.user),
  };
}

export async function loginAccount(
  input: { email: string; password: string },
  signal?: AbortSignal,
): Promise<AuthSession> {
  const response = await request<unknown>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
    signal,
  });
  return adaptSession(response);
}

export async function registerAccount(
  input: { name: string; phone?: string; email: string; password: string },
  signal?: AbortSignal,
): Promise<AuthSession> {
  const response = await request<unknown>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
    signal,
  });
  return adaptSession(response);
}

export async function fetchAvailability(
  date: string,
  signal?: AbortSignal,
): Promise<readonly { time: string; available: boolean }[]> {
  const response = await request<unknown>(
    `/api/bookings/availability?date=${encodeURIComponent(date)}`,
    { signal },
  );
  return arrayValue(response).map((item) => {
    const row = record(item);
    return { time: stringValue(row.time), available: Boolean(row.available) };
  });
}

export async function createBooking(
  payload: BookingPayload,
  accessToken: string,
  signal?: AbortSignal,
): Promise<CreatedBooking> {
  const response = record(
    await request<unknown>(
      '/api/bookings',
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Idempotency-Key': payload.client_request_id },
        signal,
      },
      accessToken,
    ),
  );
  const id = stringValue(response.id);
  if (!id) throw new ShcApiError('예약 응답에 식별자가 없습니다.', 502, 'INVALID_BOOKING_RESPONSE');
  return {
    id,
    status: stringValue(response.status, 'pending'),
    reservationDate: nullableString(first(response, 'reservationDate', 'reservation_date')),
    reservationTime: nullableString(first(response, 'reservationTime', 'reservation_time')),
  };
}

function adaptAttachment(value: unknown): BookingAttachment {
  const row = record(value);
  return {
    id: stringValue(row.id),
    bookingId: stringValue(first(row, 'bookingId', 'booking_id')),
    clientAttachmentId: stringValue(first(row, 'clientAttachmentId', 'client_attachment_id')),
    status: stringValue(row.status),
  };
}

function adaptUploadIntent(value: unknown): BookingAttachmentUploadIntent {
  const row = record(value);
  return {
    attachment: adaptAttachment(row.attachment),
    uploadMethod: row.uploadMethod === 'tus' ? 'tus' : 'signed_put',
    bucketId: stringValue(row.bucketId),
    objectPath: stringValue(row.objectPath),
    signedUrl: nullableString(row.signedUrl),
    tusEndpoint: nullableString(row.tusEndpoint),
    storageApiKey: nullableString(row.storageApiKey),
    uploadToken: stringValue(row.uploadToken),
    chunkSizeBytes: numberValue(row.chunkSizeBytes, 6 * 1024 * 1024),
  };
}

async function createAttachmentIntent(
  bookingId: string,
  media: SelectedBookingMedia,
  accessToken: string,
): Promise<BookingAttachmentUploadIntent> {
  const response = await request<unknown>(
    `/api/bookings/${encodeURIComponent(bookingId)}/attachments/upload-intents`,
    {
      method: 'POST',
      body: JSON.stringify({
        clientAttachmentId: media.id,
        kind: media.kind,
        contentType: media.file.type,
        sizeBytes: media.file.size,
      }),
    },
    accessToken,
  );
  return adaptUploadIntent(response);
}

async function uploadSignedFile(intent: BookingAttachmentUploadIntent, file: File): Promise<void> {
  if (!intent.signedUrl) {
    throw new ShcApiError('서버가 업로드 주소를 제공하지 않았습니다.', 502, 'UPLOAD_URL_MISSING');
  }
  const body = new FormData();
  body.append('cacheControl', '0');
  body.append('', file.slice(0, file.size, file.type));
  const response = await fetch(intent.signedUrl, {
    method: 'PUT',
    headers: { 'x-upsert': 'false' },
    body,
  });
  if (!response.ok) {
    throw new ShcApiError(`파일 업로드가 실패했습니다. (${response.status})`, response.status, 'UPLOAD_FAILED');
  }
}

async function uploadTusFile(
  intent: BookingAttachmentUploadIntent,
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<void> {
  if (!intent.tusEndpoint || !intent.storageApiKey) {
    throw new ShcApiError('서버가 동영상 업로드 구성을 제공하지 않았습니다.', 502, 'TUS_CONFIG_MISSING');
  }
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: intent.tusEndpoint!,
      chunkSize: intent.chunkSizeBytes,
      uploadSize: file.size,
      retryDelays: [0, 1_000, 3_000, 5_000],
      uploadDataDuringCreation: true,
      storeFingerprintForResuming: false,
      removeFingerprintOnSuccess: true,
      headers: {
        apikey: intent.storageApiKey!,
        'x-signature': intent.uploadToken,
        'x-upsert': 'false',
      },
      metadata: {
        bucketName: intent.bucketId,
        objectName: intent.objectPath,
        contentType: file.type,
        cacheControl: '0',
      },
      onProgress(bytesUploaded, bytesTotal) {
        onProgress?.(bytesTotal ? bytesUploaded / bytesTotal : 0);
      },
      onError(error) {
        reject(new ShcApiError('동영상 업로드를 완료하지 못했습니다.', 0, 'TUS_UPLOAD_FAILED', { cause: error }));
      },
      onSuccess() {
        resolve();
      },
    });
    upload.start();
  });
}

export async function uploadBookingMedia(
  bookingId: string,
  media: SelectedBookingMedia,
  accessToken: string,
  onProgress?: (ratio: number) => void,
): Promise<BookingAttachment> {
  const intent = await createAttachmentIntent(bookingId, media, accessToken);
  if (
    intent.attachment.bookingId !== bookingId ||
    intent.attachment.clientAttachmentId !== media.id
  ) {
    throw new ShcApiError('첨부 파일 응답이 현재 예약과 일치하지 않습니다.', 502, 'ATTACHMENT_MISMATCH');
  }
  if (intent.uploadMethod === 'tus') {
    await uploadTusFile(intent, media.file, onProgress);
  } else {
    await uploadSignedFile(intent, media.file);
    onProgress?.(1);
  }
  const completed = await request<unknown>(
    `/api/bookings/${encodeURIComponent(bookingId)}/attachments/${encodeURIComponent(intent.attachment.id)}/complete`,
    { method: 'POST' },
    accessToken,
  );
  return adaptAttachment(completed);
}
