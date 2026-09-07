import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { Upload } from 'tus-js-client';

import { ApiError } from '../api';
import type { V2Api } from '../api';
import type {
  BookingAttachment,
  BookingAttachmentUploadIntent,
  LocalBookingMedia,
} from '../domain';

export type AttachmentUploadPhase = 'requesting' | 'uploading' | 'completing';

export interface AttachmentUploadProgress {
  readonly phase: AttachmentUploadPhase;
  readonly bytesSent: number;
  readonly bytesTotal: number;
  readonly progress: number;
}

export interface UploadBookingAttachmentOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: AttachmentUploadProgress) => void;
  readonly resumeCompletionForAttachmentId?: string;
  readonly storagePreviouslyUploaded?: boolean;
  readonly onIntentCreated?: (intent: BookingAttachmentUploadIntent) => void;
  readonly onStorageUploaded?: (intent: BookingAttachmentUploadIntent) => void;
}

export class MediaUploadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MediaUploadError';
  }
}

const NON_RETRYABLE_UPLOAD_CODES = new Set([
  'ATTACHMENT_IDEMPOTENCY_CONFLICT',
  'ATTACHMENT_NOT_COMPLETABLE',
  'ATTACHMENT_NOT_UPLOADABLE',
  'ATTACHMENT_VALIDATION_FAILED',
  'BOOKING_MEDIA_PILOT_DISABLED',
  'BOOKING_MEDIA_LOCKED',
  'MEDIA_TYPE_INVALID',
]);

export function canRetryBookingAttachmentUpload(error: unknown): boolean {
  return !(error instanceof ApiError && NON_RETRYABLE_UPLOAD_CODES.has(error.code));
}

function cancellationError(): Error {
  const error = new Error('첨부 파일 업로드가 취소되었습니다.');
  error.name = 'AbortError';
  return error;
}

function report(
  options: UploadBookingAttachmentOptions,
  phase: AttachmentUploadPhase,
  bytesSent: number,
  bytesTotal: number,
) {
  const safeTotal = Math.max(bytesTotal, 1);
  options.onProgress?.({
    phase,
    bytesSent,
    bytesTotal,
    progress: Math.min(1, Math.max(0, bytesSent / safeTotal)),
  });
}

async function webUpload(
  intent: BookingAttachmentUploadIntent,
  media: LocalBookingMedia,
  options: UploadBookingAttachmentOptions,
): Promise<void> {
  if (!intent.signedUrl) throw new MediaUploadError('서버가 사진 업로드 주소를 제공하지 않았습니다.');
  if (options.signal?.aborted) throw cancellationError();
  const source: Blob = media.webFile
    ? media.webFile
    : await fetch(media.uri, { signal: options.signal }).then((response) => {
        if (!response.ok) throw new MediaUploadError('선택한 파일을 읽을 수 없습니다.');
        return response.blob();
      });
  // Force the MIME metadata to match the validated intent and deliberately
  // discard the device's original filename before constructing multipart data.
  const file = source.slice(0, source.size, media.contentType);

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    request.open('PUT', intent.signedUrl!);
    request.setRequestHeader('x-upsert', 'false');
    request.upload.onprogress = (event) => {
      report(options, 'uploading', event.loaded, event.lengthComputable ? event.total : media.sizeBytes);
    };
    request.onerror = () => reject(new MediaUploadError('파일 저장소에 연결할 수 없습니다.'));
    request.onabort = () => reject(cancellationError());
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new MediaUploadError(`파일 업로드가 실패했습니다. (${request.status})`));
    };
    request.onloadend = () => options.signal?.removeEventListener('abort', abort);
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) {
      options.signal.removeEventListener('abort', abort);
      reject(cancellationError());
      return;
    }
    // Supabase's browser client wraps Blob/File uploads in multipart data. The
    // empty field name is intentional and mirrors storage-js; XMLHttpRequest
    // supplies the boundary header.
    const form = new FormData();
    form.append('cacheControl', '0');
    form.append('', file);
    request.send(form);
  });
}

async function nativeSignedUpload(
  intent: BookingAttachmentUploadIntent,
  media: LocalBookingMedia,
  options: UploadBookingAttachmentOptions,
): Promise<void> {
  if (!intent.signedUrl) throw new MediaUploadError('서버가 사진 업로드 주소를 제공하지 않았습니다.');
  if (options.signal?.aborted) throw cancellationError();
  const task = FileSystem.createUploadTask(
    intent.signedUrl,
    media.uri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        'content-type': media.contentType,
        'cache-control': 'max-age=0',
        'x-upsert': 'false',
      },
    },
    ({ totalBytesSent, totalBytesExpectedToSend }) => {
      report(
        options,
        'uploading',
        totalBytesSent,
        totalBytesExpectedToSend > 0 ? totalBytesExpectedToSend : media.sizeBytes,
      );
    },
  );
  const abort = () => void task.cancelAsync();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) {
    options.signal.removeEventListener('abort', abort);
    throw cancellationError();
  }
  try {
    const result = await task.uploadAsync();
    if (!result) throw cancellationError();
    if (result.status < 200 || result.status >= 300) {
      throw new MediaUploadError(`파일 업로드가 실패했습니다. (${result.status})`);
    }
  } finally {
    options.signal?.removeEventListener('abort', abort);
  }
}

async function tusUpload(
  intent: BookingAttachmentUploadIntent,
  media: LocalBookingMedia,
  options: UploadBookingAttachmentOptions,
): Promise<void> {
  if (!intent.tusEndpoint) throw new MediaUploadError('서버가 동영상 업로드 주소를 제공하지 않았습니다.');
  if (!intent.storageApiKey) {
    throw new MediaUploadError('서버가 동영상 업로드에 필요한 공개 API 키를 제공하지 않았습니다.');
  }
  const storageApiKey = intent.storageApiKey;
  if (options.signal?.aborted) throw cancellationError();

  const source = media.webFile
    ? media.webFile.slice(0, media.webFile.size, media.contentType)
    : ({
        uri: media.uri,
        name: `${media.clientAttachmentId}.${media.kind === 'image' ? 'jpg' : 'mp4'}`,
        type: media.contentType,
      } as unknown as File);

  await new Promise<void>((resolve, reject) => {
    let upload: Upload;
    const cleanup = () => options.signal?.removeEventListener('abort', abort);
    const abort = () => {
      cleanup();
      // Cancellation is local and immediate. Remote TUS termination is
      // best-effort in the background so a hung DELETE cannot freeze the UI.
      reject(cancellationError());
      // Ask the TUS server to terminate the partial upload as well as stopping
      // this client. Staging must verify signed DELETE/termination support;
      // failures stay private because the signed capability must not be logged.
      void upload.abort(true).catch(() => undefined);
    };
    upload = new Upload(source, {
      endpoint: intent.tusEndpoint!,
      chunkSize: intent.chunkSizeBytes,
      uploadSize: media.sizeBytes,
      retryDelays: [0, 1_000, 3_000, 5_000, 10_000],
      uploadDataDuringCreation: true,
      storeFingerprintForResuming: false,
      removeFingerprintOnSuccess: true,
      headers: {
        apikey: storageApiKey,
        'x-signature': intent.uploadToken,
        'x-upsert': 'false',
      },
      metadata: {
        bucketName: intent.bucketId,
        objectName: intent.objectPath,
        contentType: media.contentType,
        cacheControl: '0',
      },
      onProgress(bytesSent, bytesTotal) {
        report(options, 'uploading', bytesSent, bytesTotal || media.sizeBytes);
      },
      onError(error) {
        cleanup();
        reject(new MediaUploadError('파일 업로드를 완료하지 못했습니다.', { cause: error }));
      },
      onSuccess() {
        cleanup();
        resolve();
      },
    });
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) {
      cleanup();
      reject(cancellationError());
      return;
    }
    upload.start();
  });
}

export async function uploadBookingAttachment(
  api: V2Api,
  bookingId: string,
  media: LocalBookingMedia,
  options: UploadBookingAttachmentOptions = {},
): Promise<BookingAttachment> {
  if (options.signal?.aborted) throw cancellationError();

  // A prior upload attempt may have reached Storage even if its client request
  // ended as an error. Complete first: a ready object is recovered without a
  // second PUT, while a confirmed-missing object may safely receive a new
  // upload capability. Once Storage reported success, never re-PUT.
  if (options.resumeCompletionForAttachmentId) {
    report(options, 'completing', media.sizeBytes, media.sizeBytes);
    try {
      return await api.requests.attachments.complete(
        bookingId,
        options.resumeCompletionForAttachmentId,
        { signal: options.signal },
      );
    } catch (error) {
      if (
        options.storagePreviouslyUploaded ||
        !(
          error instanceof ApiError &&
          ['ATTACHMENT_UPLOAD_INCOMPLETE', 'ATTACHMENT_NOT_FOUND'].includes(error.code)
        )
      ) {
        throw error;
      }
    }
  }

  report(options, 'requesting', 0, media.sizeBytes);
  let intent: BookingAttachmentUploadIntent;
  try {
    intent = await api.requests.attachments.createUploadIntent(
      bookingId,
      {
        clientAttachmentId: media.clientAttachmentId,
        kind: media.kind,
        contentType: media.contentType,
        sizeBytes: media.sizeBytes,
      },
      { signal: options.signal },
    );
  } catch (error) {
    if (error instanceof ApiError && error.code === 'ATTACHMENT_ALREADY_COMPLETE') {
      const existing = await api.requests.attachments.list(bookingId, {
        signal: options.signal,
      });
      const completed = existing.find(
        (attachment) =>
          attachment.clientAttachmentId === media.clientAttachmentId &&
          attachment.status === 'ready',
      );
      if (completed) return completed;
    }
    throw error;
  }
  if (
    intent.attachment.bookingId !== bookingId ||
    intent.attachment.clientAttachmentId !== media.clientAttachmentId
  ) {
    throw new MediaUploadError('서버의 첨부 파일 응답이 현재 예약과 일치하지 않습니다.');
  }
  options.onIntentCreated?.(intent);

  if (intent.uploadMethod === 'tus') {
    await tusUpload(intent, media, options);
  } else if (Platform.OS === 'web') {
    await webUpload(intent, media, options);
  } else {
    await nativeSignedUpload(intent, media, options);
  }
  options.onStorageUploaded?.(intent);

  report(options, 'completing', media.sizeBytes, media.sizeBytes);
  return api.requests.attachments.complete(
    bookingId,
    intent.attachment.id,
    { signal: options.signal },
  );
}
