/**
 * Wire-format DTOs implemented by the checked-out V2 Express backend.
 * Keep these snake_case types private to the API boundary.
 */

export interface ApiErrorDto {
  readonly code?: unknown;
  readonly message?: unknown;
  readonly details?: unknown;
  readonly requestId?: unknown;
}

export interface UserDto {
  readonly id: unknown;
  readonly legacy_user_id?: unknown;
  readonly name?: unknown;
  readonly phone?: unknown;
  readonly email?: unknown;
  readonly provider?: unknown;
  readonly is_admin?: unknown;
  readonly is_guest?: unknown;
  readonly address?: unknown;
  readonly address_detail?: unknown;
}

export interface RegisteredUserDto {
  readonly id: unknown;
  readonly legacy_user_id?: unknown;
  readonly name?: unknown;
  readonly email?: unknown;
  readonly provider?: unknown;
  readonly is_admin?: unknown;
}

export interface RegisterResponseDto {
  readonly user: unknown;
  readonly token?: unknown;
  readonly accessToken?: unknown;
  readonly refreshToken?: unknown;
  readonly expiresAt?: unknown;
  readonly expiresIn?: unknown;
  readonly requiresEmailConfirmation?: unknown;
}

export interface LoginResponseDto {
  readonly token?: unknown;
  readonly accessToken?: unknown;
  readonly refreshToken: unknown;
  readonly expiresAt?: unknown;
  readonly expiresIn?: unknown;
  readonly user: unknown;
  readonly requiresEmailConfirmation?: unknown;
}

export interface DeleteResponseDto {
  readonly ok: unknown;
}

export interface AppInitializeDto {
  readonly version: unknown;
  readonly currentUser?: unknown;
  readonly featureFlags: unknown;
  readonly catalog: unknown;
  readonly settings: unknown;
  readonly localization: unknown;
}

export interface SelectedBookingOptionDto {
  readonly option_id: string;
  readonly value: string;
}

export interface CreateBookingDto {
  readonly client_request_id: string;
  readonly service_type_id: string;
  readonly subtype_id: string;
  readonly pricing_tier_id: string;
  readonly options: readonly SelectedBookingOptionDto[];
  readonly name: string;
  readonly phone?: string;
  readonly address?: string;
  readonly detail_address?: string;
  readonly symptom?: string;
  readonly memo?: string;
  readonly reservation_date: string;
  readonly reservation_time: string;
  readonly timezone: string;
}

export interface CreateBookingAttachmentIntentDto {
  readonly clientAttachmentId: string;
  readonly kind: 'image' | 'video';
  readonly contentType: string;
  readonly sizeBytes: number;
}

/** Runtime validation is performed in adapters because the backend owns these values. */
export interface BookingAttachmentDto {
  readonly id: unknown;
  readonly bookingId: unknown;
  readonly clientAttachmentId: unknown;
  readonly kind: unknown;
  readonly contentType: unknown;
  readonly sizeBytes: unknown;
  readonly status: unknown;
  readonly createdAt: unknown;
  readonly completedAt?: unknown;
  readonly downloadUrl?: unknown;
  readonly downloadUrlExpiresAt?: unknown;
}

export interface BookingAttachmentUploadIntentDto {
  readonly attachment: unknown;
  readonly uploadMethod: unknown;
  readonly bucketId: unknown;
  readonly objectPath: unknown;
  readonly signedUrl?: unknown;
  readonly tusEndpoint?: unknown;
  readonly storageApiKey: unknown;
  readonly uploadToken: unknown;
  readonly chunkSizeBytes: unknown;
  readonly expiresAt: unknown;
}

export interface BookingAttachmentDownloadDto {
  readonly downloadUrl: unknown;
  readonly downloadUrlExpiresAt: unknown;
}

/** @deprecated Use CreateBookingDto. */
export type CreateRequestDto = CreateBookingDto;

export interface AdminListResponseDto {
  readonly data: unknown;
  readonly page: unknown;
  readonly pageSize: unknown;
  readonly total: unknown;
}
