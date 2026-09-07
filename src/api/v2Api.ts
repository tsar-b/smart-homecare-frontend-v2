import type { AxiosInstance } from 'axios';

import type {
  AddressSearchResult,
  AdminBookingFilter,
  AdminBookingUpdate,
  AdminDataTable,
  AdminListQuery,
  AdminResourceMap,
  AdminTable,
  AdminUpdate,
  AppInitialization,
  AuthSession,
  BookingAttachment,
  BookingAttachmentDownload,
  BookingAttachmentUploadIntent,
  BookingAvailabilitySlot,
  CreateBookingAttachmentIntentInput,
  CreateServiceRequestInput,
  LegacyBooking,
  LoginInput,
  PaginatedResult,
  ProfileUpdateResult,
  RegisterAccountInput,
  RegistrationResult,
  ServiceRequest,
  UpdateProfileInput,
  UserProfile,
} from '../domain';
import {
  adaptAddressSearchResults,
  adaptAdminPage,
  adaptAdminResource,
  adaptAdminRoleUser,
  adaptAppInitialization,
  adaptAuthSession,
  adaptBookingAttachment,
  adaptBookingAttachmentDownload,
  adaptBookingAttachmentList,
  adaptBookingAttachmentUploadIntent,
  adaptBookingAvailabilityList,
  adaptDeleteResponse,
  adaptLegacyBooking,
  adaptLegacyBookingList,
  adaptProfileUpdate,
  adaptRegistrationResult,
  adaptServiceRequest,
  adaptServiceRequestList,
  adaptUserProfile,
  adaptUserProfileList,
  toAdminUpdateDto,
  toCreateRequestDto,
  toUpdateProfileDto,
} from './adapters';
import { resolveApiConfig, type ApiConfigOverrides, type ApiRuntimeConfig } from './config';
import {
  createHttpClient,
  type AccessTokenProvider,
  type UnauthorizedHandler,
} from './http';

export interface ApiRequestOptions {
  readonly signal?: AbortSignal;
}

export interface BookingCreateRequestOptions extends ApiRequestOptions {
  /** Must equal `input.clientRequestId`; the backend fingerprints both together. */
  readonly idempotencyKey?: string;
}

export type RefreshTokenProvider = () =>
  | string
  | null
  | undefined
  | Promise<string | null | undefined>;

export type SessionRefreshedHandler = (session: AuthSession) => void | Promise<void>;

export interface CreateV2ApiOptions extends ApiConfigOverrides {
  readonly getAccessToken?: AccessTokenProvider;
  readonly getRefreshToken?: RefreshTokenProvider;
  readonly onSessionRefreshed?: SessionRefreshedHandler;
  readonly onUnauthorized?: UnauthorizedHandler;
}

export interface AuthApi {
  readonly register: (
    input: RegisterAccountInput,
    options?: ApiRequestOptions,
  ) => Promise<RegistrationResult>;
  readonly login: (input: LoginInput, options?: ApiRequestOptions) => Promise<AuthSession>;
  readonly refresh: (refreshToken: string, options?: ApiRequestOptions) => Promise<AuthSession>;
  readonly logout: (options?: ApiRequestOptions) => Promise<void>;
}

export interface ProfileApi {
  readonly get: (options?: ApiRequestOptions) => Promise<UserProfile>;
  readonly update: (
    input: UpdateProfileInput,
    options?: ApiRequestOptions,
  ) => Promise<ProfileUpdateResult>;
}

export interface CatalogApi {
  readonly initialize: (options?: ApiRequestOptions) => Promise<AppInitialization>;
}

export interface AddressApi {
  readonly search: (
    query: string,
    options?: ApiRequestOptions,
  ) => Promise<readonly AddressSearchResult[]>;
}

export interface RequestsApi {
  readonly create: (
    input: CreateServiceRequestInput,
    options?: BookingCreateRequestOptions,
  ) => Promise<ServiceRequest>;
  readonly availability: (
    date: string,
    options?: ApiRequestOptions,
  ) => Promise<readonly BookingAvailabilitySlot[]>;
  readonly list: (options?: ApiRequestOptions) => Promise<readonly ServiceRequest[]>;
  readonly history: (options?: ApiRequestOptions) => Promise<readonly ServiceRequest[]>;
  readonly detail: (id: string, options?: ApiRequestOptions) => Promise<ServiceRequest>;
  readonly get: (id: string, options?: ApiRequestOptions) => Promise<ServiceRequest>;
  readonly cancel: (id: string, options?: ApiRequestOptions) => Promise<ServiceRequest>;
  readonly attachments: BookingAttachmentsApi;
}

export interface BookingAttachmentsApi {
  readonly list: (
    bookingId: string,
    options?: ApiRequestOptions,
  ) => Promise<readonly BookingAttachment[]>;
  readonly createUploadIntent: (
    bookingId: string,
    input: CreateBookingAttachmentIntentInput,
    options?: ApiRequestOptions,
  ) => Promise<BookingAttachmentUploadIntent>;
  readonly complete: (
    bookingId: string,
    attachmentId: string,
    options?: ApiRequestOptions,
  ) => Promise<BookingAttachment>;
  readonly getDownloadUrl: (
    bookingId: string,
    attachmentId: string,
    options?: ApiRequestOptions,
  ) => Promise<BookingAttachmentDownload>;
  readonly remove: (
    bookingId: string,
    attachmentId: string,
    options?: ApiRequestOptions,
  ) => Promise<boolean>;
}

export interface AdminUsersApi {
  readonly list: (options?: ApiRequestOptions) => Promise<readonly UserProfile[]>;
  readonly setRole: (
    id: string,
    isAdmin: boolean,
    options?: ApiRequestOptions,
  ) => Promise<UserProfile>;
  readonly updateRole: (
    id: string,
    isAdmin: boolean,
    options?: ApiRequestOptions,
  ) => Promise<UserProfile>;
  readonly remove: (id: string, options?: ApiRequestOptions) => Promise<boolean>;
}

export interface AdminBookingsApi {
  readonly attachments: AdminBookingAttachmentsApi;
  readonly list: (options?: ApiRequestOptions) => Promise<readonly ServiceRequest[]>;
  readonly filter: (
    filter: AdminBookingFilter,
    options?: ApiRequestOptions,
  ) => Promise<readonly ServiceRequest[]>;
  readonly get: (id: string, options?: ApiRequestOptions) => Promise<ServiceRequest>;
  readonly update: (
    id: string,
    patch: AdminBookingUpdate,
    options?: ApiRequestOptions,
  ) => Promise<ServiceRequest>;
  readonly updateStatus: (
    id: string,
    patch: AdminBookingUpdate,
    options?: ApiRequestOptions,
  ) => Promise<ServiceRequest>;
  readonly remove: (id: string, options?: ApiRequestOptions) => Promise<boolean>;
}

export interface AdminBookingAttachmentsApi {
  readonly list: (
    bookingId: string,
    options?: ApiRequestOptions,
  ) => Promise<readonly BookingAttachment[]>;
  readonly getDownloadUrl: (
    bookingId: string,
    attachmentId: string,
    options?: ApiRequestOptions,
  ) => Promise<BookingAttachmentDownload>;
}

export interface AdminDataApi {
  readonly list: <T extends AdminDataTable>(
    table: T,
    query?: AdminListQuery,
    options?: ApiRequestOptions,
  ) => Promise<PaginatedResult<AdminResourceMap[T]>>;
  readonly create: <T extends AdminDataTable>(
    table: T,
    values: AdminUpdate<T>,
    options?: ApiRequestOptions,
  ) => Promise<AdminResourceMap[T]>;
  readonly update: <T extends AdminDataTable>(
    table: T,
    id: string,
    patch: AdminUpdate<T>,
    options?: ApiRequestOptions,
  ) => Promise<AdminResourceMap[T]>;
  readonly remove: (
    table: AdminDataTable,
    id: string,
    options?: ApiRequestOptions,
  ) => Promise<boolean>;
}

export interface AdminApi {
  readonly users: AdminUsersApi;
  readonly bookings: AdminBookingsApi;
  readonly data: AdminDataApi;
  /** Compatibility bridge for screens migrating from the old generic client. */
  readonly list: <T extends AdminTable>(
    table: T,
    query?: AdminListQuery,
    options?: ApiRequestOptions,
  ) => Promise<PaginatedResult<AdminResourceMap[T]>>;
  /** Compatibility bridge for screens migrating from the old generic client. */
  readonly update: <T extends AdminTable>(
    table: T,
    id: string,
    patch: AdminUpdate<T>,
    options?: ApiRequestOptions,
  ) => Promise<AdminResourceMap[T]>;
  /** Compatibility bridge for screens migrating from the old generic client. */
  readonly remove: (
    table: AdminTable,
    id: string,
    options?: ApiRequestOptions,
  ) => Promise<boolean>;
}

export interface V2Api {
  readonly config: ApiRuntimeConfig;
  readonly auth: AuthApi;
  readonly profile: ProfileApi;
  readonly catalog: CatalogApi;
  readonly address: AddressApi;
  readonly requests: RequestsApi;
  readonly bookings: RequestsApi;
  readonly admin: AdminApi;
}

function requestConfig(options?: ApiRequestOptions) {
  return options?.signal ? { signal: options.signal } : undefined;
}

function requireId(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${label} must not be empty`);
  return encodeURIComponent(normalized);
}

function compactQuery(query: AdminListQuery | undefined): Record<string, unknown> | undefined {
  if (!query) return undefined;
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== ''),
  );
}

function createAuthApi(publicHttp: AxiosInstance, authenticatedHttp: AxiosInstance): AuthApi {
  return {
    async register(input, options) {
      const response = await publicHttp.post('/api/auth/register', input, requestConfig(options));
      return adaptRegistrationResult(response.data);
    },
    async login(input, options) {
      const response = await publicHttp.post('/api/auth/login', input, requestConfig(options));
      return adaptAuthSession(response.data);
    },
    async refresh(refreshToken, options) {
      const normalized = refreshToken.trim();
      if (!normalized) throw new TypeError('Refresh token must not be empty');
      const response = await publicHttp.post(
        '/api/auth/refresh',
        { refresh_token: normalized },
        requestConfig(options),
      );
      return adaptAuthSession(response.data, 'refreshResponse');
    },
    async logout(options) {
      await authenticatedHttp.post('/api/auth/logout', undefined, requestConfig(options));
    },
  };
}

function createProfileApi(http: AxiosInstance): ProfileApi {
  return {
    async get(options) {
      const response = await http.get('/api/users/me', requestConfig(options));
      return adaptUserProfile(response.data, 'profile');
    },
    async update(input, options) {
      const response = await http.patch(
        '/api/users/me',
        toUpdateProfileDto(input),
        requestConfig(options),
      );
      return adaptProfileUpdate(response.data);
    },
  };
}

function createCatalogApi(http: AxiosInstance): CatalogApi {
  return {
    async initialize(options) {
      const response = await http.get('/api/app/initialize', requestConfig(options));
      return adaptAppInitialization(response.data);
    },
  };
}

function createAddressApi(http: AxiosInstance): AddressApi {
  return {
    async search(query, options) {
      const normalized = query.trim();
      if (!normalized) throw new TypeError('Address query must not be empty');
      const response = await http.get('/api/kakao/address', {
        ...requestConfig(options),
        params: { query: normalized },
      });
      return adaptAddressSearchResults(response.data);
    },
  };
}

function attachmentPath(bookingId: string, suffix = ''): string {
  const encodedBookingId = encodeURIComponent(requireId(bookingId, 'Booking ID'));
  return `/api/bookings/${encodedBookingId}/attachments${suffix}`;
}

function createBookingAttachmentsApi(authenticatedHttp: AxiosInstance): BookingAttachmentsApi {
  return {
    async list(bookingId, options) {
      const response = await authenticatedHttp.get(
        attachmentPath(bookingId),
        requestConfig(options),
      );
      return adaptBookingAttachmentList(response.data);
    },
    async createUploadIntent(bookingId, input, options) {
      const response = await authenticatedHttp.post(
        attachmentPath(bookingId, '/upload-intents'),
        input,
        requestConfig(options),
      );
      return adaptBookingAttachmentUploadIntent(response.data);
    },
    async complete(bookingId, attachmentId, options) {
      const id = encodeURIComponent(requireId(attachmentId, 'Attachment ID'));
      const response = await authenticatedHttp.post(
        attachmentPath(bookingId, `/${id}/complete`),
        undefined,
        requestConfig(options),
      );
      return adaptBookingAttachment(response.data, 'bookingAttachment.complete');
    },
    async getDownloadUrl(bookingId, attachmentId, options) {
      const id = encodeURIComponent(requireId(attachmentId, 'Attachment ID'));
      const response = await authenticatedHttp.get(
        attachmentPath(bookingId, `/${id}/download-url`),
        requestConfig(options),
      );
      return adaptBookingAttachmentDownload(response.data);
    },
    async remove(bookingId, attachmentId, options) {
      const id = encodeURIComponent(requireId(attachmentId, 'Attachment ID'));
      const response = await authenticatedHttp.delete(
        attachmentPath(bookingId, `/${id}`),
        requestConfig(options),
      );
      return response.status === 204 || response.data === undefined || response.data === ''
        ? true
        : adaptDeleteResponse(response.data);
    },
  };
}

function createRequestsApi(authenticatedHttp: AxiosInstance, publicHttp: AxiosInstance): RequestsApi {
  const attachments = createBookingAttachmentsApi(authenticatedHttp);
  const list = async (options?: ApiRequestOptions) => {
    const response = await authenticatedHttp.get(
      '/api/bookings/history',
      requestConfig(options),
    );
    return adaptServiceRequestList(response.data, 'booking.history');
  };
  const detail = async (id: string, options?: ApiRequestOptions) => {
    const bookingId = requireId(id, 'Booking ID');
    const response = await authenticatedHttp.get(
      `/api/bookings/${bookingId}`,
      requestConfig(options),
    );
    return adaptServiceRequest(response.data, 'booking.detail');
  };

  return {
    async create(input, options) {
      const body = toCreateRequestDto(input);
      const explicitKey = options?.idempotencyKey?.trim();
      if (explicitKey && explicitKey !== input.clientRequestId) {
        throw new TypeError('Idempotency-Key must equal clientRequestId');
      }
      const response = await authenticatedHttp.post('/api/bookings', body, {
        ...requestConfig(options),
        headers: { 'Idempotency-Key': explicitKey ?? input.clientRequestId },
      });
      return adaptServiceRequest(response.data, 'booking.create');
    },
    async availability(date, options) {
      const normalized = date.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        throw new TypeError('Availability date must use YYYY-MM-DD');
      }
      const response = await publicHttp.get('/api/bookings/availability', {
        ...requestConfig(options),
        params: { date: normalized },
      });
      return adaptBookingAvailabilityList(response.data);
    },
    list,
    history: list,
    detail,
    get: detail,
    async cancel(id, options) {
      const bookingId = requireId(id, 'Booking ID');
      const response = await authenticatedHttp.patch(
        `/api/bookings/${bookingId}/cancel`,
        undefined,
        requestConfig(options),
      );
      return adaptServiceRequest(response.data, 'booking.cancel');
    },
    attachments,
  };
}

function paginate<T>(rows: readonly T[], query?: AdminListQuery): PaginatedResult<T> {
  const page = query?.page ?? 1;
  const pageSize = query?.pageSize ?? Math.max(rows.length, 1);
  const from = (page - 1) * pageSize;
  return {
    data: rows.slice(from, from + pageSize),
    page,
    pageSize,
    total: rows.length,
  };
}

function comparableBookingStatus(status: string | null): string | null {
  switch (status) {
    case '대기':
      return 'pending';
    case '확정':
    case 'approved':
      return 'confirmed';
    case '완료':
      return 'completed';
    case '취소':
    case 'canceled':
      return 'cancelled';
    default:
      return status;
  }
}

function filterCompatibilityBookings<T extends ServiceRequest | LegacyBooking>(
  rows: readonly T[],
  query?: AdminListQuery,
): readonly T[] {
  const search = query?.search?.trim().toLocaleLowerCase();
  const filtered = rows.filter((row) => {
    if (
      query?.status &&
      comparableBookingStatus(row.status) !== comparableBookingStatus(query.status)
    ) {
      return false;
    }
    if (query?.dateFrom && (!row.reservationDate || row.reservationDate < query.dateFrom)) {
      return false;
    }
    if (query?.dateTo && (!row.reservationDate || row.reservationDate > query.dateTo)) {
      return false;
    }
    if (search) {
      const haystack = [row.name, row.phone, row.address]
        .filter((value): value is string => typeof value === 'string')
        .join(' ')
        .toLocaleLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
  return query?.direction === 'asc' ? [...filtered].reverse() : filtered;
}

function createAdminApi(http: AxiosInstance): AdminApi {
  const fetchBookingPayload = async (
    query: AdminListQuery | undefined,
    options?: ApiRequestOptions,
  ): Promise<unknown> => {
    if (query?.dateFrom && query.dateTo) {
      const response = await http.post(
        '/api/admin/bookings/filter',
        {
          start: query.dateFrom,
          end: query.dateTo,
        },
        requestConfig(options),
      );
      return response.data;
    }
    const response = await http.get('/api/admin/bookings', requestConfig(options));
    return response.data;
  };

  const updateBookingPayload = async (
    id: string,
    patch: AdminBookingUpdate,
    options?: ApiRequestOptions,
  ): Promise<unknown> => {
    const bookingId = requireId(id, 'Booking ID');
    const body = {
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.totalPrice !== undefined ? { totalPrice: patch.totalPrice } : {}),
      ...(patch.options !== undefined ? { options: patch.options } : {}),
    };
    if (Object.keys(body).length === 0) {
      throw new TypeError('At least one booking field is required');
    }
    const response = await http.patch(
      `/api/admin/bookings/${bookingId}/status`,
      body,
      requestConfig(options),
    );
    return response.data;
  };

  const users: AdminUsersApi = {
    async list(options) {
      const response = await http.get('/api/admin/users', requestConfig(options));
      return adaptUserProfileList(response.data, 'admin.users');
    },
    async setRole(id, isAdmin, options) {
      const userId = requireId(id, 'User ID');
      const response = await http.patch(
        `/api/admin/users/${userId}/role`,
        { isAdmin },
        requestConfig(options),
      );
      return adaptAdminRoleUser(response.data);
    },
    async updateRole(id, isAdmin, options) {
      return users.setRole(id, isAdmin, options);
    },
    async remove(id, options) {
      const userId = requireId(id, 'User ID');
      const response = await http.delete(
        `/api/admin/users/${userId}`,
        requestConfig(options),
      );
      return adaptDeleteResponse(response.data);
    },
  };

  const bookingAttachments: AdminBookingAttachmentsApi = {
    async list(bookingId, options) {
      const id = encodeURIComponent(requireId(bookingId, 'Booking ID'));
      const response = await http.get(
        `/api/admin/bookings/${id}/attachments`,
        requestConfig(options),
      );
      return adaptBookingAttachmentList(response.data, 'admin.bookingAttachments');
    },
    async getDownloadUrl(bookingId, attachmentId, options) {
      const id = encodeURIComponent(requireId(bookingId, 'Booking ID'));
      const mediaId = encodeURIComponent(requireId(attachmentId, 'Attachment ID'));
      const response = await http.get(
        `/api/admin/bookings/${id}/attachments/${mediaId}/download-url`,
        requestConfig(options),
      );
      return adaptBookingAttachmentDownload(response.data, 'admin.bookingAttachmentDownload');
    },
  };

  const bookings: AdminBookingsApi = {
    attachments: bookingAttachments,
    async list(options) {
      const response = await http.get('/api/admin/bookings', requestConfig(options));
      return adaptServiceRequestList(response.data, 'admin.bookings');
    },
    async filter(filter, options) {
      const response = await http.post(
        '/api/admin/bookings/filter',
        {
          start: filter.start,
          end: filter.end,
          ...(filter.status ? { status: filter.status } : {}),
        },
        requestConfig(options),
      );
      return adaptServiceRequestList(response.data, 'admin.bookings.filter');
    },
    async get(id, options) {
      const bookingId = requireId(id, 'Booking ID');
      const response = await http.get(
        `/api/admin/bookings/${bookingId}`,
        requestConfig(options),
      );
      return adaptServiceRequest(response.data, 'admin.booking');
    },
    async update(id, patch, options) {
      const payload = await updateBookingPayload(id, patch, options);
      return adaptServiceRequest(payload, 'admin.booking.update');
    },
    async updateStatus(id, patch, options) {
      return bookings.update(id, patch, options);
    },
    async remove(id, options) {
      const bookingId = requireId(id, 'Booking ID');
      const response = await http.delete(
        `/api/admin/bookings/${bookingId}`,
        requestConfig(options),
      );
      return adaptDeleteResponse(response.data);
    },
  };

  const data: AdminDataApi = {
    async list(table, query, options) {
      const response = await http.get(`/api/admin/data/${encodeURIComponent(table)}`, {
        ...requestConfig(options),
        params: compactQuery(query),
      });
      return adaptAdminPage(table, response.data);
    },
    async create(table, values, options) {
      const response = await http.post(
        `/api/admin/data/${encodeURIComponent(table)}`,
        toAdminUpdateDto(values),
        requestConfig(options),
      );
      return adaptAdminResource(table, response.data, `admin.data.${table}.create`);
    },
    async update(table, id, patch, options) {
      const rowId = requireId(id, 'Admin row ID');
      const response = await http.patch(
        `/api/admin/data/${encodeURIComponent(table)}/${rowId}`,
        toAdminUpdateDto(patch),
        requestConfig(options),
      );
      return adaptAdminResource(table, response.data, `admin.data.${table}.update`);
    },
    async remove(table, id, options) {
      const rowId = requireId(id, 'Admin row ID');
      const response = await http.delete(
        `/api/admin/data/${encodeURIComponent(table)}/${rowId}`,
        requestConfig(options),
      );
      return adaptDeleteResponse(response.data);
    },
  };

  return {
    users,
    bookings,
    data,
    async list(table, query, options) {
      if (table === 'users') {
        return paginate(await users.list(options), query) as PaginatedResult<AdminResourceMap[typeof table]>;
      }
      if (table === 'requests') {
        const payload = await fetchBookingPayload(query, options);
        const rows = filterCompatibilityBookings(
          adaptServiceRequestList(payload, 'admin.requests.compatibility'),
          query,
        );
        return paginate(rows, query) as PaginatedResult<AdminResourceMap[typeof table]>;
      }
      if (table === 'bookings') {
        const payload = await fetchBookingPayload(query, options);
        const rows = filterCompatibilityBookings(
          adaptLegacyBookingList(payload, 'admin.bookings.compatibility'),
          query,
        );
        return paginate(rows, query) as PaginatedResult<AdminResourceMap[typeof table]>;
      }
      return data.list(table, query, options) as Promise<PaginatedResult<AdminResourceMap[typeof table]>>;
    },
    async update(table, id, patch, options) {
      if (table === 'requests') {
        const value = await updateBookingPayload(id, patch as AdminBookingUpdate, options);
        return adaptServiceRequest(
          value,
          'admin.requests.compatibility.update',
        ) as AdminResourceMap[typeof table];
      }
      if (table === 'bookings') {
        const value = await updateBookingPayload(id, patch as AdminBookingUpdate, options);
        return adaptLegacyBooking(
          value,
          'admin.bookings.compatibility.update',
        ) as AdminResourceMap[typeof table];
      }
      if (table === 'users') {
        const candidate = patch as Record<string, unknown>;
        if (typeof candidate.isAdmin !== 'boolean') {
          throw new TypeError('The specialized user update requires isAdmin');
        }
        return users.setRole(id, candidate.isAdmin, options) as Promise<AdminResourceMap[typeof table]>;
      }
      return data.update(table, id, patch, options) as Promise<AdminResourceMap[typeof table]>;
    },
    async remove(table, id, options) {
      if (table === 'users') return users.remove(id, options);
      if (table === 'requests' || table === 'bookings') return bookings.remove(id, options);
      return data.remove(table, id, options);
    },
  };
}

/**
 * Create an isolated V2 client. Token persistence stays in AuthContext; this
 * layer coordinates one refresh and one replay for each failed request.
 */
export function createV2Api(options: CreateV2ApiOptions = {}): V2Api {
  const config = resolveApiConfig(options);
  const publicHttp = createHttpClient(config);
  const refreshAccessToken = options.getRefreshToken
    ? async () => {
        const refreshToken = (await options.getRefreshToken?.())?.trim();
        if (!refreshToken) return null;
        const response = await publicHttp.post('/api/auth/refresh', {
          refresh_token: refreshToken,
        });
        const session = adaptAuthSession(response.data, 'refreshResponse');
        await options.onSessionRefreshed?.(session);
        return session.accessToken;
      }
    : undefined;
  const authenticatedHttp = createHttpClient(config, {
    getAccessToken: options.getAccessToken ?? (() => null),
    refreshAccessToken,
    onUnauthorized: options.onUnauthorized,
  });
  const requests = createRequestsApi(authenticatedHttp, publicHttp);

  return {
    config,
    auth: createAuthApi(publicHttp, authenticatedHttp),
    profile: createProfileApi(authenticatedHttp),
    catalog: createCatalogApi(publicHttp),
    address: createAddressApi(publicHttp),
    requests,
    bookings: requests,
    admin: createAdminApi(authenticatedHttp),
  };
}
