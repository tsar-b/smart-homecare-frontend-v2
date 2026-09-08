const assert = require('node:assert/strict');
const test = require('node:test');
const React = require('react');
const { loadTypeScript } = require('./helpers/loadTypeScript.cjs');

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const native = {
  Platform: { OS: 'android', select: values => values.android ?? values.default },
  StyleSheet: { create: value => value, absoluteFillObject: {} },
  Alert: { alert: () => {} },
  ...Object.fromEntries(['Image', 'View', 'Text', 'Pressable', 'ActivityIndicator', 'Modal', 'SafeAreaView'].map(name => [name, name])),
};

// Minimal hook lifecycle adapter: render actual component handlers while the
// native host views and OS dialogs remain mocks. Native visual QA is separate.
function hooks() {
  const slots = [];
  let index = 0;
  let effects = [];
  return {
    react: {
      ...React,
      useRef: initial => {
        const at = index++;
        slots[at] ??= { current: initial };
        return slots[at];
      },
      useState: initial => {
        const at = index++;
        slots[at] ??= { value: typeof initial === 'function' ? initial() : initial };
        return [slots[at].value, value => {
          slots[at].value = typeof value === 'function' ? value(slots[at].value) : value;
        }];
      },
      useEffect: (effect, deps) => {
        const at = index++;
        const prior = slots[at];
        if (prior && deps?.every((value, i) => Object.is(value, prior.deps?.[i]))) return;
        effects.push(() => {
          prior?.cleanup?.();
          slots[at] = { deps, cleanup: effect() };
        });
      },
    },
    render(component, props) {
      index = 0;
      const tree = component(props);
      const pending = effects;
      effects = [];
      pending.forEach(effect => effect());
      return tree;
    },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return undefined;
  if (predicate(tree)) return tree;
  const children = Array.isArray(tree) ? tree : tree.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const match = find(child, predicate);
    if (match) return match;
  }
}

function pickerFixture(pick, prepare) {
  const lifecycle = hooks();
  let permissions = 0;
  let launches = 0;
  let prepared = 0;
  class MediaSelectionError extends Error {}
  const { BookingMediaPicker } = loadTypeScript('src/components/BookingMediaPicker.tsx', {
    react: lifecycle.react,
    'react-native': native,
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    './Button': { Button: 'Button' },
    'expo-image-picker': {
      requestMediaLibraryPermissionsAsync: async () => { permissions++; return { granted: false }; },
      launchImageLibraryAsync: async (...args) => { launches++; return pick(...args); },
    },
    '../media': {
      BOOKING_MEDIA_PILOT_UPLOADS_ENABLED: false, MAX_BOOKING_ATTACHMENTS: 6, MediaSelectionError,
      formatMediaBytes: value => String(value), formatMediaDuration: () => '',
      validateCombinedMedia: () => {},
      preparePickedMedia: async asset => {
        prepared++;
        return prepare ? prepare(asset) : {
          clientAttachmentId: `selection-${prepared}`, kind: 'image', uri: `file:///normalized-${prepared}.jpg`, sizeBytes: 100,
        };
      },
    },
  });
  return {
    ...lifecycle,
    render: props => lifecycle.render(BookingMediaPicker, props),
    counts: () => ({ permissions, launches, prepared }),
  };
}

test('Android system picker works when broad library access is denied and ignores rapid double taps', async () => {
  const selection = deferred();
  const f = pickerFixture(() => selection.promise);
  let result;
  const tree = f.render({ value: [], onChange: value => { result = value; } });
  const button = find(tree, node => node.type === 'Button');
  button.props.onPress();
  button.props.onPress();
  assert.deepEqual(f.counts(), { permissions: 0, launches: 1, prepared: 0 });
  selection.resolve({ canceled: false, assets: [{ assetId: 'original', uri: 'file:///original.jpg' }] });
  await tick();
  assert.equal(result.length, 1);
});

test('photo normalization does not defeat deduplication in a batch or later selections', async () => {
  const asset = { assetId: 'same-photo', uri: 'file:///original.jpg' };
  const f = pickerFixture(async () => ({ canceled: false, assets: [asset, asset] }));
  let value = [];
  const change = result => { value = result; };
  find(f.render({ value, onChange: change }), node => node.type === 'Button').props.onPress();
  await tick();
  assert.equal(value.length, 1);
  find(f.render({ value, onChange: change }), node => node.type === 'Button').props.onPress();
  await tick();
  assert.equal(value.length, 1);
  assert.equal(f.counts().prepared, 1);
});

test('picker result after unmount never updates its former booking', async () => {
  const selection = deferred();
  const f = pickerFixture(() => selection.promise);
  let updates = 0;
  find(f.render({ value: [], onChange: () => updates++ }), node => node.type === 'Button').props.onPress();
  f.unmount();
  selection.resolve({ canceled: false, assets: [{ uri: 'file:///original.jpg' }] });
  await tick();
  assert.equal(updates, 0);
  assert.equal(f.counts().prepared, 0);
});

test('selection merges current parent value when native preparation completes later', async () => {
  const preparation = deferred();
  const f = pickerFixture(async () => ({ canceled: false, assets: [{ uri: 'file:///original.jpg' }] }), () => preparation.promise);
  let value;
  find(f.render({ value: [], onChange: result => { value = result; } }), node => node.type === 'Button').props.onPress();
  await tick();
  const other = { clientAttachmentId: 'other', kind: 'image', uri: 'file:///other.jpg', sizeBytes: 100 };
  f.render({ value: [other], onChange: result => { value = result; } });
  preparation.resolve({ clientAttachmentId: 'new', kind: 'image', uri: 'file:///new.jpg', sizeBytes: 100 });
  await tick();
  assert.deepEqual(value.map(item => item.clientAttachmentId), ['other', 'new']);
});

test('closed viewer does not retain a video player; playback errors become visible and listener is released', () => {
  const lifecycle = hooks();
  let listener;
  let removed = 0;
  const player = { status: 'readyToPlay', addListener: (_, callback) => {
    listener = callback;
    return { remove: () => removed++ };
  } };
  const { BookingMediaViewer } = loadTypeScript('src/components/BookingMediaViewer.tsx', {
    react: lifecycle.react,
    'react-native': native,
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-video': { VideoView: 'VideoView', useVideoPlayer: () => player },
  });
  const props = { visible: false, attachment: { kind: 'video' }, url: 'https://storage.example.test/signed', onRequestClose() {} };
  const closed = BookingMediaViewer(props);
  assert.equal(find(closed, node => node.type?.name === 'VideoContent'), undefined);
  const open = BookingMediaViewer({ ...props, visible: true });
  const video = find(open, node => node.type?.name === 'VideoContent');
  lifecycle.render(video.type, video.props);
  listener({ status: 'error', error: { message: 'private signed URL must not be rendered' } });
  const error = lifecycle.render(video.type, video.props);
  assert.equal(error.type.name, 'MediaLoadError');
  lifecycle.unmount();
  assert.equal(removed, 1);
});

test('expired or failed signed image shows recovery instructions instead of a blank viewer', () => {
  const lifecycle = hooks();
  const { BookingMediaViewer } = loadTypeScript('src/components/BookingMediaViewer.tsx', {
    react: lifecycle.react,
    'react-native': native,
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-video': { VideoView: 'VideoView', useVideoPlayer: () => {} },
  });
  const open = BookingMediaViewer({ visible: true, attachment: { kind: 'image' }, url: 'https://storage.example.test/signed', onRequestClose() {} });
  const image = find(open, node => node.type?.name === 'ImageContent');
  const tree = lifecycle.render(image.type, image.props);
  find(tree, node => node.type === 'Image').props.onError({ nativeEvent: { error: 'expired' } });
  assert.equal(lifecycle.render(image.type, image.props).type.name, 'MediaLoadError');
});
