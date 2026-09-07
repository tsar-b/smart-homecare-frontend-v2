/**
 * Application-facing models for the V2 HTTP API.
 *
 * These types deliberately use camelCase. Database and HTTP DTO field names are
 * translated in `src/api/adapters.ts`, keeping Supabase's snake_case names out
 * of React components and navigation state.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };

export type IdentityProvider = 'standard' | 'guest' | 'kakao' | 'apple' | string;

export interface UserProfile {
  readonly id: string;
  readonly legacyUserId: number | null;
  readonly name: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly provider: IdentityProvider | null;
  readonly isAdmin: boolean;
  readonly isGuest: boolean;
  readonly address: string | null;
  readonly addressDetail: string | null;
}

export interface RegisteredAccount {
  readonly id: string;
  readonly legacyUserId: number | null;
  readonly name: string | null;
  readonly email: string | null;
  readonly provider: IdentityProvider | null;
  readonly isAdmin: boolean;
}

export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number | null;
  readonly expiresIn: number | null;
  readonly user: UserProfile;
}

export interface RegistrationResult {
  readonly user: UserProfile | null;
  readonly accessToken: string | null;
  readonly refreshToken: string | null;
  readonly expiresAt: number | null;
  readonly expiresIn: number | null;
  readonly requiresEmailConfirmation: boolean;
}

export interface RegisterAccountInput {
  readonly name: string;
  readonly phone?: string;
  readonly email: string;
  readonly password: string;
  readonly address?: string;
  readonly addressDetail?: string;
}

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export interface UpdateProfileInput {
  readonly name?: string;
  readonly phone?: string;
  readonly address?: string;
  readonly addressDetail?: string;
}

/** The V2 PATCH /users/me response intentionally returns only editable fields. */
export interface ProfileUpdateResult {
  readonly id: string;
  readonly name: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly addressDetail: string | null;
}

export interface AddressSearchResult {
  readonly addressName: string;
  readonly roadAddress: string | null;
  readonly lotAddress: string | null;
  readonly buildingName: string | null;
  readonly zoneNumber: string | null;
  readonly longitude: string | null;
  readonly latitude: string | null;
}

export interface FeatureFlags {
  readonly requests: boolean;
  readonly adminCrud: boolean;
  readonly kakaoAddress: boolean;
  readonly [flag: string]: boolean;
}

export interface CatalogCategory {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly sortOrder: number;
  readonly metadata: JsonObject;
}

export interface CatalogServiceType {
  readonly id: string;
  readonly categoryId: string | null;
  readonly key: string;
  readonly label: string;
  readonly sortOrder: number;
  readonly metadata: JsonObject;
}

export interface PricingTier {
  readonly id: string;
  readonly serviceTypeId: string | null;
  readonly serviceType: string | null;
  readonly subtype: string | null;
  readonly key: string;
  readonly label: string;
  readonly basePrice: number;
  readonly sortOrder: number;
  readonly memo: string | null;
  readonly metadata: JsonObject;
}

export interface RequestOption {
  readonly id: string;
  readonly serviceTypeId: string | null;
  readonly key: string;
  readonly label: string;
  readonly extraCost: number;
  /** Choice schemas are migrated JSON and are intentionally retained losslessly. */
  readonly appliesTo: readonly JsonValue[];
  readonly choices: readonly JsonValue[];
  readonly serviceTypes: readonly JsonValue[];
  readonly sortOrder: number;
  readonly metadata: JsonObject;
}

export interface CatalogSubtype {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly category: string | null;
  readonly iconUrl: string | null;
  /** Nested legacy service data is retained until the catalog is fully normalized. */
  readonly serviceOptions: readonly JsonValue[];
}

export interface CatalogAsset {
  readonly id: string;
  readonly serviceType: string | null;
  readonly kind: string | null;
  readonly tier: string | null;
  readonly partId: string | null;
  readonly subtype: string | null;
  readonly label: string | null;
  readonly steps: readonly JsonValue[];
  readonly url: string | null;
}

export interface TimeSlotGroup {
  readonly id: string;
  /** Calendar date in the backend's `YYYY-MM-DD` form, when date-specific. */
  readonly date: string | null;
  readonly type: string | null;
  readonly slots: readonly JsonValue[];
}

export interface AppCatalog {
  readonly categories: readonly CatalogCategory[];
  readonly serviceTypes: readonly CatalogServiceType[];
  readonly subtypes: readonly CatalogSubtype[];
  readonly pricingTiers: readonly PricingTier[];
  readonly options: readonly RequestOption[];
  readonly assets: readonly CatalogAsset[];
  readonly timeSlots: readonly TimeSlotGroup[];
}

export interface AppInitialization {
  readonly version: string;
  readonly currentUser: UserProfile | null;
  readonly featureFlags: FeatureFlags;
  readonly catalog: AppCatalog;
  readonly settings: {
    readonly timezone: string;
    readonly currency: string;
  };
  readonly localization: {
    readonly defaultLocale: string;
    readonly supportedLocales: readonly string[];
  };
}

export interface CreateServiceRequestInput {
  readonly clientRequestId: string;
  readonly categoryId?: string;
  readonly serviceTypeId: string;
  readonly subtypeId: string;
  readonly pricingTierId: string;
  /** Canonical booking selections. Both the option ID and chosen value are required. */
  readonly selectedOptions?: readonly BookingOptionInput[];
  /** @deprecated IDs alone cannot represent a booking choice; retained during screen migration. */
  readonly optionIds?: readonly string[];
  readonly name: string;
  readonly phone?: string;
  readonly address?: string;
  readonly detailAddress?: string;
  readonly symptom?: string;
  readonly memo?: string;
  /** Local service calendar date. Do not create this value with `toISOString()`. */
  readonly reservationDate: string;
  readonly reservationTime: string;
  readonly timezone?: string;
}

export interface BookingOptionInput {
  readonly optionId: string;
  readonly value: string;
}

export interface BookingOptionSnapshot {
  readonly optionId: string;
  readonly key: string | null;
  readonly label: string | null;
  readonly value: string;
  readonly selectedLabel: string | null;
  readonly extraCost: number;
}

export interface BookingAvailabilitySlot {
  readonly time: string;
  readonly available: boolean;
}

export type BookingMediaKind = 'image' | 'video';
export type BookingAttachmentStatus = 'pending' | 'ready' | 'deleting' | 'rejected';
export type BookingAttachmentUploadMethod = 'signed_put' | 'tus';

/**
 * A device-local selection. `webFile` is populated only by Expo ImagePicker on
 * web and deliberately never crosses the API boundary.
 */
export interface LocalBookingMedia {
  readonly clientAttachmentId: string;
  readonly kind: BookingMediaKind;
  readonly uri: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly durationMs: number | null;
  readonly webFile?: File;
}

export interface CreateBookingAttachmentIntentInput {
  readonly clientAttachmentId: string;
  readonly kind: BookingMediaKind;
  readonly contentType: string;
  readonly sizeBytes: number;
}

export interface BookingAttachment {
  readonly id: string;
  readonly bookingId: string;
  readonly clientAttachmentId: string;
  readonly kind: BookingMediaKind;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly status: BookingAttachmentStatus;
  readonly createdAt: string;
  readonly completedAt: string | null;
  /** Short-lived capability URL. Never persist this value. */
  readonly downloadUrl: string | null;
  readonly downloadUrlExpiresAt: string | null;
}

export interface BookingAttachmentUploadIntent {
  readonly attachment: BookingAttachment;
  readonly uploadMethod: BookingAttachmentUploadMethod;
  readonly bucketId: string;
  readonly objectPath: string;
  readonly signedUrl: string | null;
  readonly tusEndpoint: string | null;
  /** Supabase publishable/anon key used only by the signed TUS transport. */
  readonly storageApiKey: string | null;
  readonly uploadToken: string;
  readonly chunkSizeBytes: number;
  readonly expiresAt: string;
}

export interface BookingAttachmentDownload {
  readonly downloadUrl: string;
  readonly downloadUrlExpiresAt: string;
}

export interface ServiceRequest {
  readonly id: string;
  readonly userId: string;
  readonly legacyUserId: number | null;
  readonly categoryId: string | null;
  readonly serviceTypeId: string | null;
  readonly subtypeId: string | null;
  readonly pricingTierId: string | null;
  readonly serviceType: string | null;
  readonly subtype: string | null;
  readonly tier: string | null;
  readonly serviceLabel: string | null;
  readonly optionSnapshots: readonly BookingOptionSnapshot[];
  readonly optionIds: readonly string[];
  readonly name: string;
  readonly phone: string | null;
  readonly address: string | null;
  readonly detailAddress: string | null;
  readonly symptom: string | null;
  readonly memo: string | null;
  readonly reservationDate: string;
  readonly reservationTime: string;
  readonly timezone: string;
  readonly status: string;
  readonly totalPrice: number;
  readonly legacyId: string | null;
  readonly migrationSource: string | null;
  readonly migratedAt: string | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
}

/** Compatibility table exposed by the current generic admin controller. */
export interface LegacyBooking {
  readonly id: string;
  readonly userId: string | null;
  readonly legacyUserId: number | null;
  readonly assetId: string | null;
  readonly name: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly detailAddress: string | null;
  readonly isGuest: boolean;
  readonly subtype: string | null;
  readonly serviceType: string | null;
  readonly reservationDate: string | null;
  readonly reservationTime: string | null;
  readonly options: JsonValue | null;
  readonly tier: string | null;
  readonly memo: string | null;
  readonly symptom: string | null;
  readonly status: string | null;
  readonly totalPrice: number | null;
  readonly createdAt: string | null;
}

export interface AuditLog {
  readonly id: string;
  readonly actorId: string | null;
  readonly tableName: string;
  readonly rowId: string;
  readonly action: string;
  readonly patch: JsonValue | null;
  readonly createdAt: string | null;
}

export interface AdminResourceMap {
  readonly users: UserProfile;
  readonly requests: ServiceRequest;
  readonly bookings: LegacyBooking;
  readonly assets: CatalogAsset;
  readonly categories: CatalogCategory;
  readonly options: RequestOption;
  readonly pricings: PricingTier;
  readonly servicetypes: CatalogServiceType;
  readonly subtypes: CatalogSubtype;
  readonly timeslots: TimeSlotGroup;
  readonly audit_logs: AuditLog;
}

export type AdminTable = keyof AdminResourceMap;

export interface AdminListQuery {
  readonly page?: number;
  readonly pageSize?: number;
  readonly sort?: string;
  readonly direction?: 'asc' | 'desc';
  readonly status?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly search?: string;
}

export interface AdminBookingFilter {
  readonly start: string;
  readonly end: string;
  readonly status?: string;
}

export interface AdminBookingUpdate {
  readonly status?: string;
  readonly totalPrice?: number;
  readonly options?: readonly JsonValue[];
}

export type AdminDataTable = Exclude<AdminTable, 'users' | 'bookings'>;

export interface PaginatedResult<T> {
  readonly data: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

type AdminManagedKey =
  | 'id'
  | 'userId'
  | 'legacyUserId'
  | 'isAdmin'
  | 'createdAt'
  | 'updatedAt'
  | 'migratedAt'
  | 'migrationSource';

/**
 * A deliberately narrower view of the backend's generic patch body. The API
 * also blocks protected database columns; excluding them here catches mistakes
 * before a network request is made.
 */
export type AdminUpdate<T extends AdminTable> = Partial<
  Omit<AdminResourceMap[T], AdminManagedKey>
>;
