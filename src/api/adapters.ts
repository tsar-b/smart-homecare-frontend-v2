import type {
  AddressSearchResult,
  AdminResourceMap,
  AdminTable,
  AdminUpdate,
  AppInitialization,
  AuditLog,
  AuthSession,
  BookingAttachment,
  BookingAttachmentDownload,
  BookingAttachmentStatus,
  BookingAttachmentUploadIntent,
  BookingAttachmentUploadMethod,
  BookingAvailabilitySlot,
  BookingOptionSnapshot,
  CatalogAsset,
  CatalogCategory,
  CatalogServiceType,
  CreateServiceRequestInput,
  JsonObject,
  JsonValue,
  LegacyBooking,
  PaginatedResult,
  PricingTier,
  ProfileUpdateResult,
  RegistrationResult,
  RegisteredAccount,
  RequestOption,
  ServiceRequest,
  TimeSlotGroup,
  UpdateProfileInput,
  UserProfile,
  CatalogSubtype,
} from '../domain';
import type { CreateRequestDto } from './contracts';
import { ApiContractError } from './errors';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown, path: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApiContractError(path, 'an object');
  }
  return value as UnknownRecord;
}

function first(record: UnknownRecord, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
}

function requiredString(
  record: UnknownRecord,
  path: string,
  ...keys: readonly string[]
): string {
  const value = first(record, keys);
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiContractError(`${path}.${keys[0]}`, 'a non-empty string');
  }
  return value;
}

function nullableString(
  record: UnknownRecord,
  path: string,
  ...keys: readonly string[]
): string | null {
  const value = first(record, keys);
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new ApiContractError(`${path}.${keys[0]}`, 'a string or null');
  }
  return value;
}

function requiredNumber(
  record: UnknownRecord,
  path: string,
  ...keys: readonly string[]
): number {
  const value = first(record, keys);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiContractError(`${path}.${keys[0]}`, 'a finite number');
  }
  return value;
}

function numberOrDefault(
  record: UnknownRecord,
  path: string,
  fallback: number,
  ...keys: readonly string[]
): number {
  const value = first(record, keys);
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiContractError(`${path}.${keys[0]}`, 'a finite number');
  }
  return value;
}

function nullableNumber(
  record: UnknownRecord,
  path: string,
  ...keys: readonly string[]
): number | null {
  const value = first(record, keys);
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiContractError(`${path}.${keys[0]}`, 'a finite number or null');
  }
  return value;
}

function booleanOrDefault(
  record: UnknownRecord,
  path: string,
  fallback: boolean,
  ...keys: readonly string[]
): boolean {
  const value = first(record, keys);
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') {
    throw new ApiContractError(`${path}.${keys[0]}`, 'a boolean');
  }
  return value;
}

function requiredBoolean(
  record: UnknownRecord,
  path: string,
  ...keys: readonly string[]
): boolean {
  const value = first(record, keys);
  if (typeof value !== 'boolean') {
    throw new ApiContractError(`${path}.${keys[0]}`, 'a boolean');
  }
  return value;
}

function toJsonValue(value: unknown, path: string): JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    return value.map((item, index) => toJsonValue(item, `${path}[${index}]`));
  }
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = toJsonValue(item, `${path}.${key}`);
    }
    return result;
  }
  throw new ApiContractError(path, 'valid JSON');
}

function jsonObjectOrEmpty(value: unknown, path: string): JsonObject {
  if (value === undefined || value === null) return {};
  const json = toJsonValue(value, path);
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new ApiContractError(path, 'a JSON object');
  }
  return json;
}

function jsonArrayOrEmpty(value: unknown, path: string): readonly JsonValue[] {
  if (value === undefined || value === null) return [];
  const json = toJsonValue(value, path);
  if (!Array.isArray(json)) throw new ApiContractError(path, 'a JSON array');
  return json;
}

function stringArray(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value)) throw new ApiContractError(path, 'an array of strings');
  return value.map((item, index) => {
    if (typeof item !== 'string') {
      throw new ApiContractError(`${path}[${index}]`, 'a string');
    }
    return item;
  });
}

function mapRows<T>(
  value: unknown,
  path: string,
  adapter: (row: unknown, rowPath: string) => T,
): readonly T[] {
  if (!Array.isArray(value)) throw new ApiContractError(path, 'an array');
  return value.map((row, index) => adapter(row, `${path}[${index}]`));
}

export function adaptUserProfile(value: unknown, path = 'user'): UserProfile {
  const row = asRecord(value, path);
  return {
    id: requiredString(row, path, 'id', '_id'),
    legacyUserId: nullableNumber(row, path, 'legacy_user_id', 'legacyUserId', 'userId'),
    name: nullableString(row, path, 'name'),
    phone: nullableString(row, path, 'phone'),
    email: nullableString(row, path, 'email'),
    provider: nullableString(row, path, 'provider'),
    isAdmin: booleanOrDefault(row, path, false, 'is_admin', 'isAdmin'),
    isGuest: booleanOrDefault(row, path, false, 'is_guest', 'isGuest'),
    address: nullableString(row, path, 'address'),
    addressDetail: nullableString(row, path, 'address_detail', 'addressDetail'),
  };
}

export function adaptUserProfileList(
  value: unknown,
  path = 'users',
): readonly UserProfile[] {
  return mapRows(value, path, adaptUserProfile);
}

export function adaptAdminRoleUser(value: unknown): UserProfile {
  const row = asRecord(value, 'admin.userRole');
  return adaptUserProfile(row.user, 'admin.userRole.user');
}

export function adaptRegisteredAccount(value: unknown): RegisteredAccount {
  const response = asRecord(value, 'registerResponse');
  const row = asRecord(response.user, 'registerResponse.user');
  return {
    id: requiredString(row, 'registerResponse.user', 'id', '_id'),
    legacyUserId: nullableNumber(
      row,
      'registerResponse.user',
      'legacy_user_id',
      'legacyUserId',
      'userId',
    ),
    name: nullableString(row, 'registerResponse.user', 'name'),
    email: nullableString(row, 'registerResponse.user', 'email'),
    provider: nullableString(row, 'registerResponse.user', 'provider'),
    isAdmin: booleanOrDefault(row, 'registerResponse.user', false, 'is_admin', 'isAdmin'),
  };
}

export function adaptRegistrationResult(value: unknown): RegistrationResult {
  const row = asRecord(value, 'registerResponse');
  const accessToken = nullableString(row, 'registerResponse', 'accessToken', 'token');
  const refreshToken = nullableString(row, 'registerResponse', 'refreshToken');
  const user =
    row.user === undefined || row.user === null
      ? null
      : adaptUserProfile(row.user, 'registerResponse.user');
  const requiresEmailConfirmation = booleanOrDefault(
    row,
    'registerResponse',
    accessToken === null,
    'requiresEmailConfirmation',
  );

  if ((accessToken === null) !== (refreshToken === null)) {
    throw new ApiContractError(
      'registerResponse',
      'both accessToken and refreshToken, or neither token',
    );
  }
  if (requiresEmailConfirmation === (accessToken !== null)) {
    throw new ApiContractError(
      'registerResponse.requiresEmailConfirmation',
      'a value consistent with the returned session tokens',
    );
  }
  if (accessToken !== null && user === null) {
    throw new ApiContractError('registerResponse.user', 'a user for an active session');
  }

  return {
    user,
    accessToken,
    refreshToken,
    expiresAt: nullableNumber(row, 'registerResponse', 'expiresAt'),
    expiresIn: nullableNumber(row, 'registerResponse', 'expiresIn'),
    requiresEmailConfirmation,
  };
}

export function adaptAuthSession(value: unknown, path = 'loginResponse'): AuthSession {
  const row = asRecord(value, path);
  if (booleanOrDefault(row, path, false, 'requiresEmailConfirmation')) {
    throw new ApiContractError(`${path}.requiresEmailConfirmation`, 'false for an active session');
  }
  return {
    accessToken: requiredString(row, path, 'accessToken', 'token'),
    refreshToken: requiredString(row, path, 'refreshToken'),
    expiresAt: nullableNumber(row, path, 'expiresAt'),
    expiresIn: nullableNumber(row, path, 'expiresIn'),
    user: adaptUserProfile(row.user, `${path}.user`),
  };
}

export function adaptCatalogCategory(
  value: unknown,
  path = 'category',
): CatalogCategory {
  const row = asRecord(value, path);
  return {
    id: requiredString(row, path, 'id', '_id'),
    key: requiredString(row, path, 'key', 'name'),
    label: requiredString(row, path, 'label', 'name'),
    sortOrder: numberOrDefault(row, path, 0, 'sort_order', 'sortOrder'),
    metadata: jsonObjectOrEmpty(row.metadata, `${path}.metadata`),
  };
}

export function adaptCatalogServiceType(
  value: unknown,
  path = 'serviceType',
): CatalogServiceType {
  const row = asRecord(value, path);
  return {
    id: requiredString(row, path, 'id', '_id'),
    categoryId: nullableString(row, path, 'category_id', 'categoryId'),
    key: requiredString(row, path, 'key', 'name'),
    label: requiredString(row, path, 'label', 'name'),
    sortOrder: numberOrDefault(row, path, 0, 'sort_order', 'sortOrder'),
    metadata: jsonObjectOrEmpty(row.metadata, `${path}.metadata`),
  };
}

export function adaptPricingTier(value: unknown, path = 'pricingTier'): PricingTier {
  const row = asRecord(value, path);
  return {
    id: requiredString(row, path, 'id', '_id'),
    serviceTypeId: nullableString(row, path, 'service_type_id', 'serviceTypeId'),
    serviceType: nullableString(row, path, 'service_type', 'serviceType'),
    subtype: nullableString(row, path, 'subtype'),
    key: requiredString(row, path, 'key', 'tier'),
    label: requiredString(row, path, 'label', 'tier', 'key'),
    basePrice: numberOrDefault(row, path, 0, 'base_price', 'basePrice', 'price'),
    sortOrder: numberOrDefault(row, path, 0, 'sort_order', 'sortOrder'),
    memo: nullableString(row, path, 'memo'),
    metadata: jsonObjectOrEmpty(row.metadata, `${path}.metadata`),
  };
}

export function adaptRequestOption(value: unknown, path = 'option'): RequestOption {
  const row = asRecord(value, path);
  return {
    id: requiredString(row, path, 'id', '_id'),
    serviceTypeId: nullableString(row, path, 'service_type_id', 'serviceTypeId'),
    key: requiredString(row, path, 'key', 'name'),
    label: requiredString(row, path, 'label', 'name'),
    extraCost: numberOrDefault(row, path, 0, 'extra_cost', 'extraCost'),
    appliesTo: jsonArrayOrEmpty(first(row, ['applies_to', 'appliesTo']), `${path}.applies_to`),
    choices: jsonArrayOrEmpty(row.choices, `${path}.choices`),
    serviceTypes: jsonArrayOrEmpty(
      first(row, ['service_types', 'serviceTypes']),
      `${path}.service_types`,
    ),
    sortOrder: numberOrDefault(row, path, 0, 'sort_order', 'sortOrder'),
    metadata: jsonObjectOrEmpty(row.metadata, `${path}.metadata`),
  };
}

export function adaptCatalogSubtype(value: unknown, path = 'subtype'): CatalogSubtype {
  const row = asRecord(value, path);
  return {
    id: requiredString(row, path, 'id', '_id'),
    key: requiredString(row, path, 'key', 'name'),
    label: requiredString(row, path, 'label', 'name', 'key'),
    category: nullableString(row, path, 'category'),
    iconUrl: nullableString(row, path, 'icon_url', 'iconUrl'),
    serviceOptions: jsonArrayOrEmpty(
      first(row, ['service_options', 'serviceOptions']),
      `${path}.service_options`,
    ),
  };
}

export function adaptCatalogAsset(value: unknown, path = 'asset'): CatalogAsset {
  const row = asRecord(value, path);
  return {
    id: requiredString(row, path, 'id', '_id'),
    serviceType: nullableString(row, path, 'service_type', 'serviceType'),
    kind: nullableString(row, path, 'kind'),
    tier: nullableString(row, path, 'tier'),
    partId: nullableString(row, path, 'part_id', 'partId'),
    subtype: nullableString(row, path, 'subtype'),
    label: nullableString(row, path, 'label'),
    steps: jsonArrayOrEmpty(row.steps, `${path}.steps`),
    url: nullableString(row, path, 'url'),
  };
}

export function adaptTimeSlotGroup(value: unknown, path = 'timeSlot'): TimeSlotGroup {
  const row = asRecord(value, path);
  return {
    id: requiredString(row, path, 'id', '_id'),
    date: nullableString(row, path, 'date'),
    type: nullableString(row, path, 'type'),
    slots: jsonArrayOrEmpty(row.slots, `${path}.slots`),
  };
}

function adaptFeatureFlags(value: unknown): AppInitialization['featureFlags'] {
  const row = asRecord(value, 'appInitialization.featureFlags');
  const flags: Record<string, boolean> = {};
  for (const [key, flag] of Object.entries(row)) {
    if (typeof flag !== 'boolean') {
      throw new ApiContractError(`appInitialization.featureFlags.${key}`, 'a boolean');
    }
    flags[key] = flag;
  }
  return {
    ...flags,
    requests: flags.requests ?? false,
    adminCrud: flags.adminCrud ?? false,
    kakaoAddress: flags.kakaoAddress ?? false,
  };
}

export function adaptAppInitialization(value: unknown): AppInitialization {
  const root = asRecord(value, 'appInitialization');
  const catalog = asRecord(root.catalog, 'appInitialization.catalog');
  const settings = asRecord(root.settings, 'appInitialization.settings');
  const localization = asRecord(root.localization, 'appInitialization.localization');
  const currentUser = root.currentUser;

  return {
    version: requiredString(root, 'appInitialization', 'version'),
    currentUser:
      currentUser === undefined || currentUser === null
        ? null
        : adaptUserProfile(currentUser, 'appInitialization.currentUser'),
    featureFlags: adaptFeatureFlags(root.featureFlags),
    catalog: {
      categories: mapRows(
        catalog.categories,
        'appInitialization.catalog.categories',
        adaptCatalogCategory,
      ),
      serviceTypes: mapRows(
        first(catalog, ['serviceTypes', 'service_types']),
        'appInitialization.catalog.serviceTypes',
        adaptCatalogServiceType,
      ),
      subtypes: mapRows(
        catalog.subtypes,
        'appInitialization.catalog.subtypes',
        adaptCatalogSubtype,
      ),
      pricingTiers: mapRows(
        first(catalog, ['pricingTiers', 'pricing_tiers']),
        'appInitialization.catalog.pricingTiers',
        adaptPricingTier,
      ),
      options: mapRows(
        catalog.options,
        'appInitialization.catalog.options',
        adaptRequestOption,
      ),
      assets: mapRows(
        catalog.assets,
        'appInitialization.catalog.assets',
        adaptCatalogAsset,
      ),
      timeSlots: mapRows(
        first(catalog, ['timeSlots', 'time_slots']),
        'appInitialization.catalog.timeSlots',
        adaptTimeSlotGroup,
      ),
    },
    settings: {
      timezone: requiredString(settings, 'appInitialization.settings', 'timezone'),
      currency: requiredString(settings, 'appInitialization.settings', 'currency'),
    },
    localization: {
      defaultLocale: requiredString(
        localization,
        'appInitialization.localization',
        'defaultLocale',
        'default_locale',
      ),
      supportedLocales: stringArray(
        first(localization, ['supportedLocales', 'supported_locales']),
        'appInitialization.localization.supportedLocales',
      ),
    },
  };
}

export function toCreateRequestDto(input: CreateServiceRequestInput): CreateRequestDto {
  if (!input.serviceTypeId?.trim()) {
    throw new TypeError('A catalog service type ID is required to create a booking');
  }
  if (!input.subtypeId?.trim()) {
    throw new TypeError('A catalog subtype ID is required to create a booking');
  }
  if (!input.pricingTierId?.trim()) {
    throw new TypeError('A catalog pricing tier ID is required to create a booking');
  }
  if (!input.selectedOptions && input.optionIds?.length) {
    throw new TypeError('Selected booking options must include both an option ID and value');
  }

  return {
    client_request_id: input.clientRequestId,
    service_type_id: input.serviceTypeId,
    subtype_id: input.subtypeId,
    pricing_tier_id: input.pricingTierId,
    options: (input.selectedOptions ?? []).map((option, index) => {
      const optionId = option.optionId.trim();
      if (!optionId) throw new TypeError(`Booking option ${index + 1} is missing an option ID`);
      if (!option.value) throw new TypeError(`Booking option ${index + 1} is missing a value`);
      return { option_id: optionId, value: option.value };
    }),
    name: input.name,
    ...(input.phone ? { phone: input.phone } : {}),
    ...(input.address ? { address: input.address } : {}),
    ...(input.detailAddress ? { detail_address: input.detailAddress } : {}),
    ...(input.symptom ? { symptom: input.symptom } : {}),
    ...(input.memo ? { memo: input.memo } : {}),
    reservation_date: input.reservationDate,
    reservation_time: input.reservationTime,
    timezone: input.timezone ?? 'Asia/Seoul',
  };
}

export function toUpdateProfileDto(input: UpdateProfileInput): Record<string, string> {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.address !== undefined ? { address: input.address } : {}),
    ...(input.addressDetail !== undefined ? { address_detail: input.addressDetail } : {}),
  };
}

export function adaptProfileUpdate(value: unknown): ProfileUpdateResult {
  const row = asRecord(value, 'profileUpdate');
  return {
    id: requiredString(row, 'profileUpdate', 'id', '_id'),
    name: nullableString(row, 'profileUpdate', 'name'),
    phone: nullableString(row, 'profileUpdate', 'phone'),
    address: nullableString(row, 'profileUpdate', 'address'),
    addressDetail: nullableString(row, 'profileUpdate', 'address_detail', 'addressDetail'),
  };
}

export function adaptAddressSearchResults(value: unknown): readonly AddressSearchResult[] {
  const root = asRecord(value, 'addressSearch');
  if (!Array.isArray(root.documents)) {
    throw new ApiContractError('addressSearch.documents', 'an array');
  }

  const results: AddressSearchResult[] = [];
  root.documents.forEach((document, index) => {
    if (typeof document !== 'object' || document === null || Array.isArray(document)) return;
    const row = document as UnknownRecord;
    const road =
      typeof row.road_address === 'object' && row.road_address !== null && !Array.isArray(row.road_address)
        ? (row.road_address as UnknownRecord)
        : {};
    const lot =
      typeof row.address === 'object' && row.address !== null && !Array.isArray(row.address)
        ? (row.address as UnknownRecord)
        : {};
    const roadAddress = nullableString(road, `addressSearch.documents[${index}].road_address`, 'address_name');
    const lotAddress = nullableString(lot, `addressSearch.documents[${index}].address`, 'address_name');
    const topLevelAddress = nullableString(row, `addressSearch.documents[${index}]`, 'address_name');
    const addressName = roadAddress ?? topLevelAddress ?? lotAddress;
    if (!addressName) return;

    results.push({
      addressName,
      roadAddress,
      lotAddress,
      buildingName: nullableString(
        road,
        `addressSearch.documents[${index}].road_address`,
        'building_name',
      ),
      zoneNumber: nullableString(
        road,
        `addressSearch.documents[${index}].road_address`,
        'zone_no',
      ),
      longitude: nullableString(row, `addressSearch.documents[${index}]`, 'x'),
      latitude: nullableString(row, `addressSearch.documents[${index}]`, 'y'),
    });
  });

  return results;
}

export function adaptDeleteResponse(value: unknown): boolean {
  const row = asRecord(value, 'deleteResponse');
  if (typeof row.ok !== 'boolean') {
    throw new ApiContractError('deleteResponse.ok', 'a boolean');
  }
  return row.ok;
}

export function adaptBookingOptionSnapshot(
  value: unknown,
  path = 'bookingOption',
): BookingOptionSnapshot {
  const row = asRecord(value, path);
  return {
    optionId: requiredString(row, path, 'option_id', '_id'),
    key: nullableString(row, path, 'key', 'option'),
    label: nullableString(row, path, 'label', 'optionLabel'),
    value: requiredString(row, path, 'value', 'choice', 'selectedValue'),
    selectedLabel: nullableString(
      row,
      path,
      'selected_label',
      'selectedLabel',
      'choiceLabel',
    ),
    extraCost: numberOrDefault(row, path, 0, 'extra_cost', 'extraCost'),
  };
}

export function adaptBookingAvailability(
  value: unknown,
  path = 'bookingAvailability',
): BookingAvailabilitySlot {
  const row = asRecord(value, path);
  return {
    time: requiredString(row, path, 'time'),
    available: requiredBoolean(row, path, 'available'),
  };
}

export function adaptBookingAvailabilityList(
  value: unknown,
  path = 'bookingAvailability',
): readonly BookingAvailabilitySlot[] {
  return mapRows(value, path, adaptBookingAvailability);
}

function bookingMediaKind(record: UnknownRecord, path: string): 'image' | 'video' {
  const value = requiredString(record, path, 'kind');
  if (value !== 'image' && value !== 'video') {
    throw new ApiContractError(`${path}.kind`, 'image or video');
  }
  return value;
}

function bookingAttachmentStatus(record: UnknownRecord, path: string): BookingAttachmentStatus {
  const value = requiredString(record, path, 'status');
  if (!['pending', 'ready', 'deleting', 'rejected'].includes(value)) {
    throw new ApiContractError(`${path}.status`, 'a recognized attachment status');
  }
  return value as BookingAttachmentStatus;
}

function bookingUploadMethod(record: UnknownRecord, path: string): BookingAttachmentUploadMethod {
  const value = requiredString(record, path, 'uploadMethod', 'upload_method');
  if (value !== 'signed_put' && value !== 'tus') {
    throw new ApiContractError(`${path}.uploadMethod`, 'signed_put or tus');
  }
  return value;
}

export function adaptBookingAttachment(
  value: unknown,
  path = 'bookingAttachment',
): BookingAttachment {
  const row = asRecord(value, path);
  const sizeBytes = requiredNumber(row, path, 'sizeBytes', 'size_bytes');
  if (sizeBytes <= 0) throw new ApiContractError(`${path}.sizeBytes`, 'a positive number');

  return {
    id: requiredString(row, path, 'id'),
    bookingId: requiredString(row, path, 'bookingId', 'booking_id'),
    clientAttachmentId: requiredString(
      row,
      path,
      'clientAttachmentId',
      'client_attachment_id',
    ),
    kind: bookingMediaKind(row, path),
    contentType: requiredString(row, path, 'contentType', 'content_type'),
    sizeBytes,
    status: bookingAttachmentStatus(row, path),
    createdAt: requiredString(row, path, 'createdAt', 'created_at'),
    completedAt: nullableString(row, path, 'completedAt', 'completed_at'),
    downloadUrl: nullableString(row, path, 'downloadUrl', 'download_url'),
    downloadUrlExpiresAt: nullableString(
      row,
      path,
      'downloadUrlExpiresAt',
      'download_url_expires_at',
    ),
  };
}

export function adaptBookingAttachmentList(
  value: unknown,
  path = 'bookingAttachments',
): readonly BookingAttachment[] {
  return mapRows(value, path, adaptBookingAttachment);
}

export function adaptBookingAttachmentUploadIntent(
  value: unknown,
  path = 'bookingAttachmentUploadIntent',
): BookingAttachmentUploadIntent {
  const row = asRecord(value, path);
  const uploadMethod = bookingUploadMethod(row, path);
  const signedUrl = nullableString(row, path, 'signedUrl', 'signed_url');
  const tusEndpoint = nullableString(row, path, 'tusEndpoint', 'tus_endpoint');
  const rawStorageApiKey = nullableString(
    row,
    path,
    'storageApiKey',
    'storage_api_key',
  );
  const storageApiKey = rawStorageApiKey?.trim() || null;
  if (uploadMethod === 'signed_put' && !signedUrl) {
    throw new ApiContractError(`${path}.signedUrl`, 'a URL for signed_put');
  }
  if (uploadMethod === 'tus' && !tusEndpoint) {
    throw new ApiContractError(`${path}.tusEndpoint`, 'a URL for tus');
  }
  if (uploadMethod === 'tus' && !storageApiKey) {
    throw new ApiContractError(`${path}.storageApiKey`, 'a non-empty public API key for tus');
  }
  if (uploadMethod === 'signed_put' && storageApiKey !== null) {
    throw new ApiContractError(`${path}.storageApiKey`, 'null for signed_put');
  }
  const chunkSizeBytes = requiredNumber(row, path, 'chunkSizeBytes', 'chunk_size_bytes');
  if (chunkSizeBytes <= 0) {
    throw new ApiContractError(`${path}.chunkSizeBytes`, 'a positive number');
  }

  return {
    attachment: adaptBookingAttachment(first(row, ['attachment']), `${path}.attachment`),
    uploadMethod,
    bucketId: requiredString(row, path, 'bucketId', 'bucket_id'),
    objectPath: requiredString(row, path, 'objectPath', 'object_path'),
    signedUrl,
    tusEndpoint,
    storageApiKey,
    uploadToken: requiredString(row, path, 'uploadToken', 'upload_token'),
    chunkSizeBytes,
    expiresAt: requiredString(row, path, 'expiresAt', 'expires_at'),
  };
}

export function adaptBookingAttachmentDownload(
  value: unknown,
  path = 'bookingAttachmentDownload',
): BookingAttachmentDownload {
  const row = asRecord(value, path);
  return {
    downloadUrl: requiredString(row, path, 'downloadUrl', 'download_url'),
    downloadUrlExpiresAt: requiredString(
      row,
      path,
      'downloadUrlExpiresAt',
      'download_url_expires_at',
    ),
  };
}

export function adaptServiceRequestList(
  value: unknown,
  path = 'bookings',
): readonly ServiceRequest[] {
  return mapRows(value, path, adaptServiceRequest);
}

export function adaptServiceRequest(value: unknown, path = 'request'): ServiceRequest {
  const row = asRecord(value, path);
  const optionSnapshots = mapRows(
    first(row, ['options']) ?? [],
    `${path}.options`,
    adaptBookingOptionSnapshot,
  );
  const rawOptionIds = first(row, ['option_ids', 'optionIds']);
  return {
    id: requiredString(row, path, 'id', '_id'),
    userId: requiredString(row, path, 'user_id', 'userId'),
    legacyUserId: nullableNumber(row, path, 'legacy_user_id', 'legacyUserId'),
    categoryId: nullableString(row, path, 'category_id', 'categoryId'),
    serviceTypeId: nullableString(row, path, 'service_type_id', 'serviceTypeId'),
    subtypeId: nullableString(row, path, 'subtype_id', 'subtypeId'),
    pricingTierId: nullableString(row, path, 'pricing_tier_id', 'pricingTierId'),
    serviceType: nullableString(row, path, 'service_type', 'serviceType'),
    subtype: nullableString(row, path, 'subtype'),
    tier: nullableString(row, path, 'tier'),
    serviceLabel: nullableString(row, path, 'service_label', 'serviceLabel'),
    optionSnapshots,
    optionIds:
      rawOptionIds === undefined || rawOptionIds === null
        ? optionSnapshots.map((option) => option.optionId)
        : stringArray(rawOptionIds, `${path}.option_ids`),
    name: requiredString(row, path, 'name'),
    phone: nullableString(row, path, 'phone'),
    address: nullableString(row, path, 'address'),
    detailAddress: nullableString(row, path, 'detail_address', 'detailAddress'),
    symptom: nullableString(row, path, 'symptom'),
    memo: nullableString(row, path, 'memo'),
    reservationDate: requiredString(row, path, 'reservation_date', 'reservationDate'),
    reservationTime: requiredString(row, path, 'reservation_time', 'reservationTime'),
    timezone: requiredString(row, path, 'timezone'),
    status: requiredString(row, path, 'status'),
    totalPrice: requiredNumber(row, path, 'total_price', 'totalPrice'),
    legacyId: nullableString(row, path, 'legacy_id', 'legacyId'),
    migrationSource: nullableString(row, path, 'migration_source', 'migrationSource'),
    migratedAt: nullableString(row, path, 'migrated_at', 'migratedAt'),
    createdAt: nullableString(row, path, 'created_at', 'createdAt'),
    updatedAt: nullableString(row, path, 'updated_at', 'updatedAt'),
  };
}

export function adaptLegacyBooking(value: unknown, path = 'booking'): LegacyBooking {
  const row = asRecord(value, path);
  const rawOptions = first(row, ['options']);
  return {
    id: requiredString(row, path, 'id', '_id'),
    userId: nullableString(row, path, 'user_id', 'userId'),
    legacyUserId: nullableNumber(row, path, 'legacy_user_id', 'legacyUserId'),
    assetId: nullableString(row, path, 'asset_id', 'assetId'),
    name: nullableString(row, path, 'name'),
    phone: nullableString(row, path, 'phone'),
    address: nullableString(row, path, 'address'),
    detailAddress: nullableString(row, path, 'detail_address', 'detailAddress'),
    isGuest: booleanOrDefault(row, path, false, 'is_guest', 'isGuest'),
    subtype: nullableString(row, path, 'subtype'),
    serviceType: nullableString(row, path, 'service_type', 'serviceType'),
    reservationDate: nullableString(row, path, 'reservation_date', 'reservationDate'),
    reservationTime: nullableString(row, path, 'reservation_time', 'reservationTime'),
    options:
      rawOptions === undefined || rawOptions === null
        ? null
        : toJsonValue(rawOptions, `${path}.options`),
    tier: nullableString(row, path, 'tier'),
    memo: nullableString(row, path, 'memo'),
    symptom: nullableString(row, path, 'symptom'),
    status: nullableString(row, path, 'status'),
    totalPrice: nullableNumber(row, path, 'total_price', 'totalPrice'),
    createdAt: nullableString(row, path, 'created_at', 'createdAt'),
  };
}

export function adaptLegacyBookingList(
  value: unknown,
  path = 'bookings',
): readonly LegacyBooking[] {
  return mapRows(value, path, adaptLegacyBooking);
}

export function adaptAuditLog(value: unknown, path = 'auditLog'): AuditLog {
  const row = asRecord(value, path);
  const rawPatch = row.patch;
  return {
    id: requiredString(row, path, 'id'),
    actorId: nullableString(row, path, 'actor_id', 'actorId'),
    tableName: requiredString(row, path, 'table_name', 'tableName'),
    rowId: requiredString(row, path, 'row_id', 'rowId'),
    action: requiredString(row, path, 'action'),
    patch:
      rawPatch === undefined || rawPatch === null
        ? null
        : toJsonValue(rawPatch, `${path}.patch`),
    createdAt: nullableString(row, path, 'created_at', 'createdAt'),
  };
}

export function adaptAdminResource<T extends AdminTable>(
  table: T,
  value: unknown,
  path = `admin.${table}`,
): AdminResourceMap[T] {
  let result: AdminResourceMap[AdminTable];
  switch (table) {
    case 'users':
      result = adaptUserProfile(value, path);
      break;
    case 'requests':
      result = adaptServiceRequest(value, path);
      break;
    case 'bookings':
      result = adaptLegacyBooking(value, path);
      break;
    case 'assets':
      result = adaptCatalogAsset(value, path);
      break;
    case 'categories':
      result = adaptCatalogCategory(value, path);
      break;
    case 'options':
      result = adaptRequestOption(value, path);
      break;
    case 'pricings':
      result = adaptPricingTier(value, path);
      break;
    case 'servicetypes':
      result = adaptCatalogServiceType(value, path);
      break;
    case 'subtypes':
      result = adaptCatalogSubtype(value, path);
      break;
    case 'timeslots':
      result = adaptTimeSlotGroup(value, path);
      break;
    case 'audit_logs':
      result = adaptAuditLog(value, path);
      break;
    default: {
      const exhaustive: never = table;
      throw new ApiContractError(path, `a supported admin resource (${exhaustive})`);
    }
  }
  return result as AdminResourceMap[T];
}

export function adaptAdminPage<T extends AdminTable>(
  table: T,
  value: unknown,
): PaginatedResult<AdminResourceMap[T]> {
  const row = asRecord(value, `admin.${table}.list`);
  return {
    data: mapRows(row.data, `admin.${table}.list.data`, (item, itemPath) =>
      adaptAdminResource(table, item, itemPath),
    ),
    page: requiredNumber(row, `admin.${table}.list`, 'page'),
    pageSize: requiredNumber(row, `admin.${table}.list`, 'pageSize'),
    total: requiredNumber(row, `admin.${table}.list`, 'total'),
  };
}

const PROTECTED_ADMIN_KEYS = new Set([
  'id',
  'userId',
  'user_id',
  'legacyUserId',
  'legacy_user_id',
  'password',
  'passwordHash',
  'password_hash',
  'isAdmin',
  'is_admin',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
  'migratedAt',
  'migrated_at',
  'migrationSource',
  'migration_source',
]);

function snakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** Convert only top-level domain patch keys; nested JSON metadata is preserved. */
export function toAdminUpdateDto<T extends AdminTable>(
  patch: AdminUpdate<T>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (PROTECTED_ADMIN_KEYS.has(key)) {
      throw new TypeError(`Admin patch contains protected field: ${key}`);
    }
    result[snakeCase(key)] = value;
  }
  return result;
}
