import type { BookingMediaKind } from '../domain';

export const MAX_BOOKING_ATTACHMENTS = 6;
export const MAX_BOOKING_VIDEOS = 2;
// Product limits are decimal bytes to match the backend and Storage bucket.
export const MAX_IMAGE_BYTES = 10_000_000;
export const MAX_VIDEO_BYTES = 45_000_000;
export const MAX_BOOKING_MEDIA_BYTES = 100_000_000;
export const MAX_VIDEO_DURATION_MS = 60 * 1000;
export const STANDARD_UPLOAD_MAX_BYTES = 6 * 1024 * 1024;

// Expo statically inlines EXPO_PUBLIC_* values. This is a presentation gate,
// while the backend remains the security authority for video/TUS access.
export const BOOKING_MEDIA_PILOT_UPLOADS_ENABLED =
  process.env.EXPO_PUBLIC_BOOKING_MEDIA_PILOT_UPLOADS === 'true';
export const MAX_SELECTABLE_IMAGE_BYTES = BOOKING_MEDIA_PILOT_UPLOADS_ENABLED
  ? MAX_IMAGE_BYTES
  : STANDARD_UPLOAD_MAX_BYTES;

export const BOOKING_MEDIA_CONTENT_TYPES: Readonly<Record<BookingMediaKind, readonly string[]>> = {
  image: ['image/jpeg', 'image/png', 'image/webp'],
  video: ['video/mp4', 'video/quicktime'],
};

export function mediaSizeLimit(kind: BookingMediaKind): number {
  return kind === 'image' ? MAX_SELECTABLE_IMAGE_BYTES : MAX_VIDEO_BYTES;
}

export function formatMediaBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.ceil(bytes / 1000)} KB`;
  const megabytes = (bytes / 1_000_000).toFixed(1).replace(/\.0$/, '');
  return `${megabytes} MB`;
}

export function formatMediaDuration(durationMs: number | null): string | null {
  if (durationMs === null) return null;
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
