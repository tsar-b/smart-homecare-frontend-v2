export type Locale = 'ko' | 'en';

export interface LocalizedText {
  readonly ko: string;
  readonly en: string;
}

export type ServiceIconName = 'aircon' | 'washer' | 'refrigerator' | 'television';

export interface ServiceDefinition {
  readonly slug: string;
  readonly icon: ServiceIconName;
  readonly name: LocalizedText;
  readonly eyebrow: LocalizedText;
  readonly summary: LocalizedText;
  readonly description: LocalizedText;
  readonly capabilities: readonly LocalizedText[];
  readonly accent: string;
}

export interface CatalogCategory {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly sortOrder?: number;
}

export interface CatalogServiceType {
  readonly id: string;
  readonly categoryId: string | null;
  readonly key: string;
  readonly label: string;
  readonly sortOrder?: number;
}

export interface CatalogSubtype {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly category: string | null;
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
}

export interface CatalogOption {
  readonly id: string;
  readonly serviceTypeId: string | null;
  readonly key: string;
  readonly label: string;
  readonly extraCost: number;
}

export interface AppCatalog {
  readonly categories: readonly CatalogCategory[];
  readonly serviceTypes: readonly CatalogServiceType[];
  readonly subtypes: readonly CatalogSubtype[];
  readonly pricingTiers: readonly PricingTier[];
  readonly options: readonly CatalogOption[];
}

export interface AppInitialization {
  readonly version: string;
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

export type CatalogSource = 'loading' | 'live' | 'preview' | 'error';

export interface AccountUser {
  readonly id: string;
  readonly name: string | null;
  readonly email: string | null;
}

export interface AuthSession {
  readonly accessToken: string | null;
  readonly refreshToken: string | null;
  readonly requiresEmailConfirmation: boolean;
  readonly user: AccountUser | null;
}

export interface BookingPayload {
  readonly client_request_id: string;
  readonly service_type_id: string;
  readonly subtype_id: string;
  readonly pricing_tier_id: string;
  readonly options: readonly {
    readonly option_id: string;
    readonly value: string;
  }[];
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

export interface CreatedBooking {
  readonly id: string;
  readonly status: string;
  readonly reservationDate: string | null;
  readonly reservationTime: string | null;
}

export type MediaKind = 'image' | 'video';

export interface SelectedBookingMedia {
  readonly id: string;
  readonly file: File;
  readonly kind: MediaKind;
}

export interface BookingAttachment {
  readonly id: string;
  readonly bookingId: string;
  readonly clientAttachmentId: string;
  readonly status: string;
}

export interface BookingAttachmentUploadIntent {
  readonly attachment: BookingAttachment;
  readonly uploadMethod: 'signed_put' | 'tus';
  readonly bucketId: string;
  readonly objectPath: string;
  readonly signedUrl: string | null;
  readonly tusEndpoint: string | null;
  readonly storageApiKey: string | null;
  readonly uploadToken: string;
  readonly chunkSizeBytes: number;
}
