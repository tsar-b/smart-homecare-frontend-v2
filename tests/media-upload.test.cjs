const assert = require('node:assert/strict');
const test = require('node:test');
const { loadTypeScript } = require('./helpers/loadTypeScript.cjs');

class ApiError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const media = {
  clientAttachmentId: 'local-photo', kind: 'image', uri: 'file:///cache/photo.jpg',
  contentType: 'image/jpeg', sizeBytes: 100, width: 10, height: 10, durationMs: null,
};
const attachment = {
  id: 'attachment', bookingId: 'booking', clientAttachmentId: media.clientAttachmentId,
  kind: 'image', contentType: media.contentType, sizeBytes: 100, status: 'ready',
};
const intent = {
  attachment: { ...attachment, status: 'pending' }, uploadMethod: 'signed_put',
  signedUrl: 'https://storage.example.test/signed',
};

function fixture({ task, info, complete, createUploadIntent } = {}) {
  const calls = [];
  const subject = loadTypeScript('src/media/uploadBookingAttachment.ts', {
    '../api': { ApiError },
    'react-native': { Platform: { OS: 'android' } },
    'tus-js-client': { Upload: class {} },
    'expo-file-system': {
      FileSystemUploadType: { BINARY_CONTENT: 0 },
      getInfoAsync: async () => { calls.push('stat'); return info ?? { exists: true, size: 100 }; },
      createUploadTask: () => {
        calls.push('upload');
        return task ?? { uploadAsync: async () => ({ status: 200 }), cancelAsync: async () => {} };
      },
    },
  });
  const api = { requests: { attachments: {
    createUploadIntent: async (...args) => {
      calls.push('intent');
      return createUploadIntent ? createUploadIntent(...args) : intent;
    },
    complete: async (...args) => {
      calls.push('complete');
      return complete ? complete(...args) : attachment;
    },
    list: async () => [attachment],
  } } };
  return { ...subject, calls, api };
}

test('native media uploads complete only after Storage accepted bytes', async () => {
  const f = fixture();
  const result = await f.uploadBookingAttachment(f.api, 'booking', media, {
    onStorageUploaded: () => f.calls.push('accepted'),
  });
  assert.equal(result, attachment);
  assert.deepEqual(f.calls, ['intent', 'stat', 'upload', 'accepted', 'complete']);
});

test('native cancellation settles even when native upload never settles and cleanup rejects', { timeout: 1000 }, async () => {
  let started;
  const start = new Promise(resolve => { started = resolve; });
  let cancelled = 0;
  const f = fixture({ task: {
    uploadAsync: () => { started(); return new Promise(() => {}); },
    cancelAsync: async () => { cancelled += 1; throw new Error('native cancellation failure'); },
  } });
  const controller = new AbortController();
  const pending = f.uploadBookingAttachment(f.api, 'booking', media, { signal: controller.signal });
  await start;
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(cancelled, 1);
  assert.ok(!f.calls.includes('complete'));
});

test('an evicted or changed native file requires reselection and never starts transfer', async () => {
  for (const info of [{ exists: false }, { exists: true, size: 101 }]) {
    const f = fixture({ info });
    await assert.rejects(f.uploadBookingAttachment(f.api, 'booking', media), error => {
      assert.equal(f.canRetryBookingAttachmentUpload(error), false);
      return error instanceof f.MediaUploadError;
    });
    assert.ok(!f.calls.includes('upload'));
    assert.ok(!f.calls.includes('complete'));
  }
});

test('completion retry recovers accepted upload even after Android evicts its cache file', async () => {
  const f = fixture({ info: { exists: false } });
  assert.equal(await f.uploadBookingAttachment(f.api, 'booking', media, {
    resumeCompletionForAttachmentId: attachment.id,
    storagePreviouslyUploaded: true,
  }), attachment);
  assert.deepEqual(f.calls, ['complete']);
});

test('lost PUT response recovers through completion without uploading bytes twice', async () => {
  const f = fixture({ task: {
    uploadAsync: async () => { throw new Error('network dropped after server accepted bytes'); },
    cancelAsync: async () => {},
  } });
  let id;
  await assert.rejects(f.uploadBookingAttachment(f.api, 'booking', media, {
    onIntentCreated: result => { id = result.attachment.id; },
  }));
  const callsBeforeRetry = f.calls.length;
  assert.equal(await f.uploadBookingAttachment(f.api, 'booking', media, {
    resumeCompletionForAttachmentId: id,
  }), attachment);
  assert.deepEqual(f.calls.slice(callsBeforeRetry), ['complete']);
});

test('expired Storage capability stays retryable and refreshes only after confirmed missing bytes', async () => {
  const failed = fixture({ task: { uploadAsync: async () => ({ status: 403 }), cancelAsync: async () => {} } });
  await assert.rejects(failed.uploadBookingAttachment(failed.api, 'booking', media), error => {
    assert.equal(failed.canRetryBookingAttachmentUpload(error), true);
    return error instanceof failed.MediaUploadError;
  });
  let attempts = 0;
  const retry = fixture({ complete: async () => {
    if (++attempts === 1) throw new ApiError('ATTACHMENT_UPLOAD_INCOMPLETE');
    return attachment;
  } });
  await retry.uploadBookingAttachment(retry.api, 'booking', media, {
    resumeCompletionForAttachmentId: attachment.id,
  });
  assert.deepEqual(retry.calls, ['complete', 'intent', 'stat', 'upload', 'complete']);
});

test('completion authentication or server failure never falls back to uploading again', async () => {
  for (const code of ['HTTP_401', 'NETWORK_ERROR', 'HTTP_500']) {
    const f = fixture({ complete: async () => { throw new ApiError(code); } });
    await assert.rejects(f.uploadBookingAttachment(f.api, 'booking', media, {
      resumeCompletionForAttachmentId: attachment.id,
    }), { code });
    assert.deepEqual(f.calls, ['complete']);
  }
});

test('successful Storage transfer never re-PUTs after an incomplete completion response', async () => {
  const f = fixture({ complete: async () => { throw new ApiError('ATTACHMENT_UPLOAD_INCOMPLETE'); } });
  await assert.rejects(f.uploadBookingAttachment(f.api, 'booking', media, {
    resumeCompletionForAttachmentId: attachment.id,
    storagePreviouslyUploaded: true,
  }), { code: 'ATTACHMENT_UPLOAD_INCOMPLETE' });
  assert.deepEqual(f.calls, ['complete']);
});
