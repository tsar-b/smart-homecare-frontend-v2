const assert = require('node:assert/strict');
const test = require('node:test');
const { loadTypeScript } = require('./helpers/loadTypeScript.cjs');

const video = {
  uri: 'file:///cache/video.mp4', type: 'video', mimeType: 'video/mp4',
  duration: 10_000, fileSize: 1, width: 100, height: 100,
};
function prepare(info) {
  return loadTypeScript('src/media/prepareMedia.ts', {
    'react-native': { Platform: { OS: 'android' } },
    'expo-crypto': { randomUUID: () => 'generated-id' },
    'expo-file-system': { getInfoAsync: async () => {
      if (info instanceof Error) throw info;
      return info;
    } },
    'expo-image-manipulator': {
      manipulateAsync: async () => ({ uri: 'file:///cache/normalized.jpg', width: 100, height: 100 }),
      SaveFormat: { JPEG: 'jpeg' },
    },
  });
}

test('native video uses actual local bytes rather than stale picker fileSize', async () => {
  const f = prepare({ exists: true, size: 2000 });
  const result = await f.preparePickedMedia(video);
  assert.equal(result.sizeBytes, 2000);
});

test('actual native bytes enforce video limit even if picker reports tiny fileSize', async () => {
  const f = prepare({ exists: true, size: 45_000_001 });
  await assert.rejects(f.preparePickedMedia(video), f.MediaSelectionError);
});

test('native size errors redact private paths and request reselection', async () => {
  const f = prepare(new Error('Unable to access /private/customer-name/video.mp4'));
  await assert.rejects(f.preparePickedMedia(video), error => {
    assert.ok(error instanceof f.MediaSelectionError);
    assert.ok(!error.message.includes('customer-name'));
    return true;
  });
});

test('invalid size metadata cannot bypass combined attachment limits', () => {
  const f = prepare({ exists: true, size: 100 });
  for (const sizeBytes of [NaN, Infinity, -100, 0, 1.5]) {
    assert.throws(() => f.validateCombinedMedia([], [{ kind: 'image', sizeBytes }]), f.MediaSelectionError);
  }
  assert.doesNotThrow(() => f.validateCombinedMedia([], [{ kind: 'image', sizeBytes: 100 }]));
});
