const assert = require('node:assert/strict');
const test = require('node:test');
const React = require('react');
const { loadTypeScript } = require('./helpers/loadTypeScript.cjs');

const tick = () => new Promise(resolve => setImmediate(resolve));
const picker = tree => find(tree, node => node.type === 'DateTimePicker');
const calendarDay = date => [date.getFullYear(), date.getMonth(), date.getDate()];
const dateButton = (tree, prefix) => find(tree, node =>
  node.type === 'Pressable' && node.props.accessibilityLabel?.startsWith(prefix));

// As in the media component tests, run production handlers with a small hook
// lifecycle adapter. Native hosts/dialogs are mocks, not native rendering proof.
function hooks() {
  const slots = [];
  let index = 0;
  let effects = [];
  const same = (left, right) => left && right && left.length === right.length &&
    left.every((value, at) => Object.is(value, right[at]));
  const memo = (factory, deps) => {
    const at = index++;
    if (!slots[at] || !same(slots[at].deps, deps)) slots[at] = { deps, value: factory() };
    return slots[at].value;
  };
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
        if (!slots[at]) {
          slots[at] = { value: typeof initial === 'function' ? initial() : initial };
          slots[at].set = value => {
            slots[at].value = typeof value === 'function' ? value(slots[at].value) : value;
          };
        }
        return [slots[at].value, slots[at].set];
      },
      useMemo: memo,
      useCallback: (callback, deps) => memo(() => callback, deps),
      useEffect: (effect, deps) => {
        const at = index++;
        const prior = slots[at];
        if (prior && same(prior.deps, deps)) return;
        const next = { deps };
        slots[at] = next;
        effects.push(() => {
          prior?.cleanup?.();
          next.cleanup = effect();
        });
      },
    },
    render(component) {
      index = 0;
      const tree = component();
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
    const found = find(child, predicate);
    if (found) return found;
  }
}

function fixture(t, screen, { os = 'android', api } = {}) {
  const lifecycle = hooks();
  const timers = [];
  t.mock.method(global, 'setInterval', (callback, delay) => { timers.push({ callback, delay }); return timers.length; });
  t.mock.method(global, 'clearInterval', () => {});
  t.after(() => lifecycle.unmount());
  const requests = api ?? {
    requests: { availability: async () => [{ time: '23:59', available: true }], list: async () => [] },
    catalog: { initialize: async () => ({ catalog: { serviceTypes: [], subtypes: [] } }) },
  };
  const components = ['AppHeader', 'AppScreen', 'BookingMediaPicker', 'Button', 'Card', 'FormField',
    'PageIntro', 'ProgressSteps', 'SectionTitle', 'StateView', 'CustomerBottomNav', 'StatusBadge'];
  const native = ['View', 'Text', 'Pressable', 'FlatList', 'RefreshControl', 'TextInput'];
  const { default: Component } = loadTypeScript(`src/screens/${screen}.tsx`, {
    react: lifecycle.react,
    'react-native': {
      Platform: { OS: os, select: values => values[os] ?? values.default },
      StyleSheet: { create: value => value }, Alert: { alert() {} },
      ...Object.fromEntries(native.map(name => [name, name])),
    },
    '@react-native-community/datetimepicker': { default: 'DateTimePicker', __esModule: true },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '@react-navigation/native': {
      useNavigation: () => ({}), usePreventRemove() {},
      useFocusEffect: callback => lifecycle.react.useEffect(callback, [callback]),
      useRoute: () => ({ params: {
        subtype: { _id: 'subtype', name: 'Wall', category: 'category' },
        serviceType: { _id: 'service', name: 'clean', label: 'Clean' },
        tier: { id: 'tier', tier: 'standard', price: -1 }, selectedOptions: [],
      } }),
    },
    'expo-crypto': {},
    '../components': Object.fromEntries(components.map(name => [name, name])),
    '../context/AuthContext': { useAuth: () => ({ api: requests, token: 'fake-test-token' }) },
    '../api': { ApiError: class ApiError extends Error {}, customerSafeErrorMessage: (_error, message) => message },
    '../media': {},
  });
  return { render: () => lifecycle.render(Component), timers };
}

test('booking picker keeps its native callback across the 30-second live clock tick', async t => {
  const f = fixture(t, 'BookingConfirm');
  f.render();
  await tick();
  dateButton(f.render(), '방문 날짜,').props.onPress();
  const before = picker(f.render()).props;
  assert.equal(f.timers.length, 1);
  assert.equal(f.timers[0].delay, 30_000);

  f.timers[0].callback();
  const after = picker(f.render()).props;
  // These are the installed Android wrapper's open/update effect dependencies.
  assert.equal(after.onChange, before.onChange);
  assert.equal(after.value.getTime(), before.value.getTime());
  assert.equal(after.mode, before.mode);

  const chosen = new Date(before.value);
  chosen.setDate(chosen.getDate() + 60);
  after.onChange({ type: 'set' }, chosen);
  assert.equal(picker(f.render()), undefined);
  dateButton(f.render(), '방문 날짜,').props.onPress();
  assert.deepEqual(calendarDay(picker(f.render()).props.value), calendarDay(chosen));
});

test('booking calendar dismissal and same-day confirmation preserve the date and selected slot', async t => {
  const f = fixture(t, 'BookingConfirm');
  f.render();
  await tick();
  dateButton(f.render(), '방문 날짜,').props.onPress();
  const tomorrow = new Date(picker(f.render()).props.value);
  tomorrow.setDate(tomorrow.getDate() + 1);
  picker(f.render()).props.onChange({ type: 'set' }, tomorrow);
  f.render();
  await tick();
  find(f.render(), node => node.props?.accessibilityRole === 'radio').props.onPress();
  dateButton(f.render(), '방문 날짜,').props.onPress();
  const original = picker(f.render()).props.value;
  const ignored = new Date(original);
  ignored.setDate(ignored.getDate() + 10);
  picker(f.render()).props.onChange({ type: 'dismissed' }, ignored);
  let tree = f.render();
  assert.equal(picker(tree), undefined);
  assert.equal(find(tree, node => node.props?.accessibilityRole === 'radio').props.accessibilityState.checked, true);

  dateButton(tree, '방문 날짜,').props.onPress();
  assert.equal(picker(f.render()).props.value, original);
  const sameDay = new Date(original);
  sameDay.setHours(12);
  picker(f.render()).props.onChange({ type: 'set' }, sameDay);
  tree = f.render();
  assert.equal(find(tree, node => node.props?.accessibilityRole === 'radio').props.accessibilityState.checked, true);
  dateButton(tree, '방문 날짜,').props.onPress();
  assert.equal(picker(f.render()).props.value, original);
});

test('booking iOS spinner still commits each selected date while remaining open', async t => {
  const f = fixture(t, 'BookingConfirm', { os: 'ios' });
  f.render();
  await tick();
  dateButton(f.render(), '방문 날짜,').props.onPress();
  const callback = picker(f.render()).props.onChange;
  const chosen = new Date(picker(f.render()).props.value);
  chosen.setDate(chosen.getDate() + 2);
  callback({ type: 'set' }, chosen);
  assert.equal(picker(f.render()).props.value, chosen);
  assert.equal(picker(f.render()).props.onChange, callback);
});

test('history picker keeps its callback while a pending history/catalog load completes', async t => {
  let resolveHistory;
  const history = new Promise(resolve => { resolveHistory = resolve; });
  const f = fixture(t, 'HistoryScreen', { api: {
    requests: { list: () => history },
    catalog: { initialize: async () => ({ catalog: { serviceTypes: [], subtypes: [] } }) },
  } });
  dateButton(f.render(), '시작일 ').props.onPress();
  const before = picker(f.render()).props;
  resolveHistory([]);
  await tick();
  const after = picker(f.render()).props;
  assert.equal(after.onChange, before.onChange);
  assert.equal(after.value.getTime(), before.value.getTime());
  assert.equal(after.maximumDate, before.maximumDate);

  const chosen = new Date(before.value);
  chosen.setDate(chosen.getDate() - 2);
  after.onChange({ type: 'set' }, chosen);
  assert.equal(picker(f.render()), undefined);
  dateButton(f.render(), '시작일 ').props.onPress();
  assert.deepEqual(calendarDay(picker(f.render()).props.value), calendarDay(chosen));
});

test('history dismissal does not commit a selected date and the end picker still commits confirmed dates', async t => {
  const f = fixture(t, 'HistoryScreen');
  f.render();
  await tick();
  dateButton(f.render(), '종료일 ').props.onPress();
  const original = picker(f.render()).props.value;
  const chosen = new Date(original);
  chosen.setDate(chosen.getDate() + 2);
  picker(f.render()).props.onChange({ type: 'dismissed' }, chosen);
  assert.equal(picker(f.render()), undefined);
  dateButton(f.render(), '종료일 ').props.onPress();
  assert.equal(picker(f.render()).props.value, original);
  picker(f.render()).props.onChange({ type: 'set' }, chosen);
  dateButton(f.render(), '종료일 ').props.onPress();
  assert.deepEqual(calendarDay(picker(f.render()).props.value), calendarDay(chosen));
});
