import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Platform } from 'react-native';

import type { BookingMediaKind, LocalBookingMedia } from '../domain';
import {
  BOOKING_MEDIA_CONTENT_TYPES,
  MAX_BOOKING_ATTACHMENTS,
  MAX_BOOKING_MEDIA_BYTES,
  MAX_BOOKING_VIDEOS,
  MAX_SELECTABLE_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_MS,
  formatMediaBytes,
} from './constants';

const MAX_IMAGE_LONG_EDGE = 1920;

export class MediaSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaSelectionError';
  }
}

function inferKind(asset: ImagePickerAsset): BookingMediaKind {
  if (asset.type === 'image') return 'image';
  if (asset.type === 'video') return 'video';
  const contentType = asset.mimeType?.toLowerCase();
  if (contentType?.startsWith('image/')) return 'image';
  if (contentType?.startsWith('video/')) return 'video';
  throw new MediaSelectionError('사진 또는 동영상 형식을 확인할 수 없습니다. 다른 파일을 선택해 주세요.');
}

function extension(uri: string, fileName?: string | null): string {
  const source = fileName || uri.split(/[?#]/, 1)[0];
  return source.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
}

function inferContentType(asset: ImagePickerAsset, kind: BookingMediaKind): string {
  const declared = asset.mimeType?.toLowerCase().trim();
  if (declared && BOOKING_MEDIA_CONTENT_TYPES[kind].includes(declared)) return declared;
  const ext = extension(asset.uri, asset.fileName);
  const inferred: Record<string, string> = {
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    mov: 'video/quicktime',
    mp4: 'video/mp4',
    m4v: 'video/mp4',
  };
  const contentType = inferred[ext];
  if (contentType && BOOKING_MEDIA_CONTENT_TYPES[kind].includes(contentType)) return contentType;
  throw new MediaSelectionError(
    kind === 'image'
      ? 'JPG, PNG 또는 WebP 사진을 선택해 주세요.'
      : 'MP4 또는 MOV 동영상을 선택해 주세요.',
  );
}

async function fileSize(uri: string, fallback?: number): Promise<number> {
  if (Platform.OS === 'web') {
    if (typeof fallback === 'number' && Number.isSafeInteger(fallback) && fallback > 0) return fallback;
    throw new MediaSelectionError('선택한 파일 크기를 확인할 수 없습니다. 다른 파일을 선택해 주세요.');
  }
  // Picker metadata can describe the original file rather than the local copy.
  // Storage validates the exact byte count, so stat the native file we upload.
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (info.exists && typeof info.size === 'number' && Number.isSafeInteger(info.size) && info.size > 0) {
      return info.size;
    }
  } catch {
    // Native errors can contain a private device path; show a safe message.
  }
  throw new MediaSelectionError('선택한 파일을 읽을 수 없습니다. 다시 선택해 주세요.');
}

async function prepareImage(asset: ImagePickerAsset): Promise<LocalBookingMedia> {
  const clientAttachmentId = Crypto.randomUUID();
  const sourceLongEdge = Math.max(asset.width || 0, asset.height || 0);
  const resize = sourceLongEdge > MAX_IMAGE_LONG_EDGE
    ? asset.width >= asset.height
      ? { width: MAX_IMAGE_LONG_EDGE }
      : { height: MAX_IMAGE_LONG_EDGE }
    : null;

  let uri: string;
  let width: number;
  let height: number;
  let webFile: File | undefined;
  const contentType = 'image/jpeg';

  // Re-encoding normalizes HEIC-like device representations, reduces upload
  // cost, and strips the original photo metadata. Failure is terminal: the
  // original file must never become an upload fallback.
  try {
    const result = await manipulateAsync(
      asset.uri,
      resize ? [{ resize }] : [],
      { compress: 0.82, format: SaveFormat.JPEG },
    );
    uri = result.uri;
    width = result.width;
    height = result.height;
    if (Platform.OS === 'web') {
      const blob = await fetch(result.uri).then((response) => {
        if (!response.ok) throw new Error('Unable to read normalized image');
        return response.blob();
      });
      webFile = new File([blob], `${clientAttachmentId}.jpg`, { type: contentType });
    }
  } catch {
    throw new MediaSelectionError(
      '사진을 개인정보가 제거된 JPEG 파일로 변환하지 못했습니다. 다른 사진을 선택하거나 JPG 또는 PNG로 변환한 뒤 다시 선택해 주세요.',
    );
  }

  const sizeBytes = await fileSize(uri, webFile?.size);
  if (sizeBytes > MAX_SELECTABLE_IMAGE_BYTES) {
    throw new MediaSelectionError(`사진은 ${formatMediaBytes(MAX_SELECTABLE_IMAGE_BYTES)} 이하만 첨부할 수 있습니다.`);
  }

  return {
    clientAttachmentId,
    kind: 'image',
    uri,
    contentType,
    sizeBytes,
    width,
    height,
    durationMs: null,
    ...(webFile ? { webFile } : {}),
  };
}

async function prepareVideo(asset: ImagePickerAsset): Promise<LocalBookingMedia> {
  const clientAttachmentId = Crypto.randomUUID();
  const contentType = inferContentType(asset, 'video');
  const durationMs = asset.duration;
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) {
    throw new MediaSelectionError('동영상 길이를 확인할 수 없습니다. 다른 파일을 선택해 주세요.');
  }
  if (durationMs > MAX_VIDEO_DURATION_MS) {
    throw new MediaSelectionError('동영상은 60초 이하만 첨부할 수 있습니다.');
  }
  let webFile: File | undefined;
  if (Platform.OS === 'web' && asset.file) {
    const extension = contentType === 'video/quicktime' ? 'mov' : 'mp4';
    const normalizedBlob = asset.file.slice(0, asset.file.size, contentType);
    webFile = new File(
      [normalizedBlob],
      `${clientAttachmentId}.${extension}`,
      { type: contentType },
    );
  }
  const sizeBytes = await fileSize(asset.uri, webFile?.size ?? asset.fileSize);
  if (sizeBytes > MAX_VIDEO_BYTES) {
    throw new MediaSelectionError(`동영상은 ${formatMediaBytes(MAX_VIDEO_BYTES)} 이하만 첨부할 수 있습니다.`);
  }

  return {
    clientAttachmentId,
    kind: 'video',
    uri: asset.uri,
    contentType,
    sizeBytes,
    width: asset.width || null,
    height: asset.height || null,
    durationMs,
    ...(webFile ? { webFile } : {}),
  };
}

export async function preparePickedMedia(asset: ImagePickerAsset): Promise<LocalBookingMedia> {
  const kind = inferKind(asset);
  return kind === 'image' ? prepareImage(asset) : prepareVideo(asset);
}

type MediaLimitDescriptor = Pick<LocalBookingMedia, 'kind' | 'sizeBytes'>;

export function validateCombinedMedia(
  existing: readonly MediaLimitDescriptor[],
  additions: readonly MediaLimitDescriptor[],
): void {
  const combined = [...existing, ...additions];
  if (combined.some((item) => !Number.isSafeInteger(item.sizeBytes) || item.sizeBytes <= 0)) {
    throw new MediaSelectionError('첨부 파일 크기가 올바르지 않습니다. 파일을 다시 선택해 주세요.');
  }
  if (combined.length > MAX_BOOKING_ATTACHMENTS) {
    throw new MediaSelectionError(`사진과 동영상은 합쳐서 ${MAX_BOOKING_ATTACHMENTS}개까지 첨부할 수 있습니다.`);
  }
  if (combined.filter((item) => item.kind === 'video').length > MAX_BOOKING_VIDEOS) {
    throw new MediaSelectionError(`동영상은 ${MAX_BOOKING_VIDEOS}개까지 첨부할 수 있습니다.`);
  }
  const total = combined.reduce((sum, item) => sum + item.sizeBytes, 0);
  if (total > MAX_BOOKING_MEDIA_BYTES) {
    throw new MediaSelectionError(
      `첨부 파일 전체 크기는 ${formatMediaBytes(MAX_BOOKING_MEDIA_BYTES)} 이하여야 합니다.`,
    );
  }
}
