import type { MediaKind, SelectedBookingMedia } from './types';

export const bookingMediaLimits = {
  maxFiles: 6,
  maxVideos: 2,
  maxImageBytes: 10_000_000,
  maxVideoBytes: 45_000_000,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'],
} as const;

export function mediaKind(file: File): MediaKind | null {
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'image';
  if (['video/mp4', 'video/quicktime'].includes(file.type)) return 'video';
  return null;
}

export function validateBookingMedia(
  existing: readonly SelectedBookingMedia[],
  additions: readonly File[],
): { accepted: readonly SelectedBookingMedia[]; errors: readonly string[] } {
  const accepted = [...existing];
  const errors: string[] = [];
  let videoCount = existing.filter((item) => item.kind === 'video').length;

  for (const file of additions) {
    if (accepted.length >= bookingMediaLimits.maxFiles) {
      errors.push('사진과 동영상은 합해서 최대 6개까지 선택할 수 있습니다.');
      break;
    }
    const kind = mediaKind(file);
    if (!kind) {
      errors.push(`${file.name}: JPG, PNG, WebP, MP4 또는 MOV 파일만 사용할 수 있습니다.`);
      continue;
    }
    if (kind === 'video' && videoCount >= bookingMediaLimits.maxVideos) {
      errors.push(`${file.name}: 동영상은 최대 2개까지 선택할 수 있습니다.`);
      continue;
    }
    const maximum = kind === 'image' ? bookingMediaLimits.maxImageBytes : bookingMediaLimits.maxVideoBytes;
    if (file.size > maximum) {
      errors.push(`${file.name}: ${kind === 'image' ? '사진은 10MB' : '동영상은 45MB'} 이하여야 합니다.`);
      continue;
    }
    accepted.push({ id: crypto.randomUUID(), file, kind });
    if (kind === 'video') videoCount += 1;
  }
  return { accepted, errors };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
