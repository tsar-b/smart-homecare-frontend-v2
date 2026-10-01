import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { AppScreen, Button, Card, FormField } from '../components';
import { useAuth } from '../context/AuthContext';
import { customerSafeErrorMessage } from '../api';
import { colors, fonts, spacing } from '../theme/tokens';
import { t, useLocale } from '../i18n';
import { isValidEmail } from './validation';
import { parseAuthCallback, parsePendingFlow, recoveryPasswordError, type PendingAuthFlow, type SocialProvider } from './browserFlow';

WebBrowser.maybeCompleteAuthSession();
const KEY = 'shc.pendingAuth.v1';
const NATIVE_REDIRECT = 'smarthomecareapplication://auth/callback';
type BrowserAuth = {
  providers: readonly SocialProvider[]; busy: boolean; error: string | null;
  configurationError: string | null; configurationLoading: boolean; canRecover: boolean;
  refreshConfiguration: () => void;
  startSocial: (provider: SocialProvider) => Promise<void>; openRecovery: () => void;
};
const Context = createContext<BrowserAuth | null>(null);
export function useBrowserAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('BrowserAuthProvider is required');
  return value;
}
async function readPending() {
  const raw = Platform.OS === 'web' ? globalThis.sessionStorage?.getItem(KEY) ?? null : await SecureStore.getItemAsync(KEY);
  return parsePendingFlow(raw);
}
let pendingWrites: Promise<void> = Promise.resolve();
function savePending(flow: PendingAuthFlow | null) {
  // Preserve call order when a cancelled flow's native deletion is still in
  // flight as a newer flow starts. Its late deletion cannot erase the new flow.
  const write = pendingWrites.catch(() => undefined).then(async () => {
    if (Platform.OS === 'web') {
      if (flow) globalThis.sessionStorage.setItem(KEY, JSON.stringify(flow));
      else globalThis.sessionStorage.removeItem(KEY);
    } else if (flow) await SecureStore.setItemAsync(KEY, JSON.stringify(flow));
    else await SecureStore.deleteItemAsync(KEY);
  });
  pendingWrites = write;
  return write;
}
async function newFlow(kind: PendingAuthFlow['kind'], provider?: SocialProvider) {
  const hex = async () => Array.from(await Crypto.getRandomBytesAsync(32), byte => byte.toString(16).padStart(2, '0')).join('');
  const verifier = await hex();
  const flow: PendingAuthFlow = { kind, provider, verifier, state: await hex(), createdAt: Date.now(),
    redirectUri: Platform.OS === 'web' ? `${globalThis.location.origin}/auth/callback` : NATIVE_REDIRECT };
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 });
  const codeChallenge = digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await savePending(flow);
  return { flow, codeChallenge };
}

export function BrowserAuthProvider({ children }: { children: React.ReactNode }) {
  useLocale();
  const { api, token, loginOAuth } = useAuth();
  const latestToken = useRef(token);
  latestToken.current = token;
  const [providers, setProviders] = useState<readonly SocialProvider[]>([]);
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const [configurationLoading, setConfigurationLoading] = useState(false);
  const [configurationRevision, setConfigurationRevision] = useState(0);
  const [canRecover, setCanRecover] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const exchanging = useRef(false);
  const generation = useRef(0);
  const handled = useRef(new Set<string>());
  const claimedFlow = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'request' | 'sent' | 'password' | 'done' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const recovery = useRef<{ code: string; flow: PendingAuthFlow } | null>(null);

  useEffect(() => {
    let current = true;
    setProviders([]);
    setCanRecover(false); setConfigurationError(null); setConfigurationLoading(Boolean(api));
    if (api) void api.auth.browserConfig().then(config => {
      if (current) { setProviders(config.providers); setCanRecover(config.recovery); }
    }).catch(() => { if (current) setConfigurationError('인증 연결을 확인하지 못했습니다. 다시 시도해 주세요.'); })
      .finally(() => { if (current) setConfigurationLoading(false); });
    return () => { current = false; };
  }, [api, configurationRevision]);

  useEffect(() => {
    if (!token) return;
    generation.current += 1;
    lock.current = false; exchanging.current = false; setBusy(false); setError(null);
    recovery.current = null;
    setModal(null); setPassword(''); setConfirm('');
    void savePending(null).catch(() => undefined);
  }, [token]);

  const handleCallback = useCallback(async (url: string) => {
    const callbackGeneration = generation.current;
    const flow = await readPending();
    if (!api || latestToken.current || callbackGeneration !== generation.current) return;
    // Ignore ordinary app links. Authentication-looking but invalid callbacks
    // show a safe error and never activate a session.
    let incoming: URL;
    try { incoming = new URL(url); } catch { return; }
    // The native URL listener and browser completion can report the same flow.
    // A consumed success or denial must not disturb its in-flight exchange or
    // replace its result with an expired-link error after pending state clears.
    if (incoming.searchParams.getAll('state').length === 1 &&
        incoming.searchParams.get('state') === claimedFlow.current) return;
    if (!flow) {
      const expected = Platform.OS === 'web' ? `${globalThis.location.origin}/auth/callback` : NATIVE_REDIRECT;
      const target = new URL(expected);
      if (incoming.protocol === target.protocol && incoming.host === target.host && incoming.pathname === target.pathname) {
        if (Platform.OS === 'web') globalThis.history.replaceState(null, '', '/');
        setError('인증 링크가 만료되었거나 이 기기에서 요청한 링크가 아닙니다. 다시 요청해 주세요.');
      }
      return;
    }
    const target = new URL(flow.redirectUri);
    if (incoming.protocol !== target.protocol || incoming.host !== target.host || incoming.pathname !== target.pathname) return;
    const operation = generation.current;
    let ownsCallback = false;
    try {
      const { code } = parseAuthCallback(url, flow);
      if (handled.current.has(code)) return;
      handled.current.add(code);
      claimedFlow.current = flow.state;
      ownsCallback = true;
      if (Platform.OS === 'web') globalThis.history.replaceState(null, '', '/');
      if (flow.kind === 'recovery') {
        recovery.current = { code, flow };
        setError(null); setPassword(''); setConfirm(''); setModal('password');
      } else {
        exchanging.current = true; lock.current = true;
        await savePending(null);
        if (operation !== generation.current) return;
        setBusy(true);
        await loginOAuth({ provider: flow.provider!, code, codeVerifier: flow.verifier });
      }
    } catch (caught) {
      if (operation !== generation.current) return;
      if (caught instanceof Error && caught.message === 'AUTH_PROVIDER_CANCELLED' && flow.kind === 'oauth') {
        if (exchanging.current || claimedFlow.current === flow.state) return;
        claimedFlow.current = flow.state;
        ownsCallback = true; lock.current = true;
        try {
          const pending = await readPending();
          if (operation !== generation.current || latestToken.current) return;
          if (pending?.state === flow.state && pending.verifier === flow.verifier) await savePending(null);
        } catch { /* Cleanup failure must not expose the provider's error text. */ }
        if (operation === generation.current && !latestToken.current) {
          setError('로그인이 취소되었습니다. 다시 시도할 수 있습니다.');
        }
      } else {
        setError('인증 링크가 만료되었거나 이 기기에서 요청한 링크가 아닙니다. 다시 요청해 주세요.');
      }
    } finally {
      if (ownsCallback && operation === generation.current) {
        exchanging.current = false;
        lock.current = false; setBusy(false);
      }
    }
  }, [api, loginOAuth, token]);

  useEffect(() => {
    if (!api) return;
    const subscription = Linking.addEventListener('url', event => { void handleCallback(event.url).catch(() => setError('인증을 완료하지 못했습니다. 다시 시작해 주세요.')); });
    void Linking.getInitialURL().then(url => { if (url) return handleCallback(url); }).catch(() => undefined);
    return () => subscription.remove();
  }, [api, handleCallback]);

  const startSocial = async (provider: SocialProvider) => {
    if (!api || token || lock.current || !providers.includes(provider)) return;
    lock.current = true; setBusy(true); setError(null);
    const operation = ++generation.current;
    handled.current.clear();
    try {
      const { flow, codeChallenge } = await newFlow('oauth', provider);
      const { authorizationUrl } = await api.auth.startOAuth({ provider, redirectUri: flow.redirectUri, state: flow.state, codeChallenge });
      if (operation !== generation.current) return;
      if (Platform.OS === 'web') {
        // Full-page redirect avoids popup blockers after async PKCE generation.
        globalThis.location.assign(authorizationUrl);
      } else {
        const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, flow.redirectUri);
        if (operation !== generation.current) return;
        if (result.type === 'success') await handleCallback(result.url);
        // A native URL listener can process success before the browser reports
        // dismiss. Never cancel an exchange that was already consumed.
        else if (handled.current.size === 0) await savePending(null);
      }
    } catch {
      if (operation === generation.current) setError('인증을 완료하지 못했습니다. 다시 시작해 주세요.');
    } finally {
      if (!exchanging.current && operation === generation.current) { lock.current = false; setBusy(false); }
    }
  };

  const requestRecovery = async () => {
    if (!api || !canRecover || latestToken.current || lock.current) return;
    if (!isValidEmail(email)) { setError('이메일 형식을 확인해 주세요.'); return; }
    lock.current = true; setBusy(true); setError(null);
    const operation = ++generation.current;
    handled.current.clear();
    try {
      const { flow, codeChallenge } = await newFlow('recovery');
      if (operation !== generation.current) return;
      await api.auth.startRecovery({ email: email.trim(), redirectUri: flow.redirectUri, state: flow.state, codeChallenge });
      if (operation !== generation.current) return;
      setModal('sent');
    } catch (caught) { if (operation === generation.current) setError(customerSafeErrorMessage(caught, '인증을 완료하지 못했습니다. 다시 시작해 주세요.')); }
    finally { if (operation === generation.current) { lock.current = false; setBusy(false); } }
  };

  const finishRecovery = async () => {
    if (!api || latestToken.current || !recovery.current || lock.current) return;
    const validation = recoveryPasswordError(password, confirm);
    if (validation) { setError(validation === 'weak' ? '영문과 숫자를 포함한 8자 이상' : '비밀번호가 서로 다릅니다.'); return; }
    const pending = recovery.current;
    if (!parsePendingFlow(JSON.stringify(pending.flow))) { setError('인증 링크가 만료되었거나 이 기기에서 요청한 링크가 아닙니다. 다시 요청해 주세요.'); return; }
    lock.current = true; setBusy(true); setError(null);
    const operation = ++generation.current;
    try {
      await api.auth.finishRecovery({ code: pending.code, codeVerifier: pending.flow.verifier, password });
      if (operation !== generation.current) return;
      recovery.current = null;
      await savePending(null).catch(() => undefined);
      if (operation !== generation.current) return;
      setPassword(''); setConfirm(''); setModal('done');
    } catch (caught) {
      if (operation !== generation.current) return;
      // Codes are one-time. An uncertain response cannot safely be replayed.
      recovery.current = null; await savePending(null).catch(() => undefined);
      setPassword(''); setConfirm(''); setModal('request');
      setError(customerSafeErrorMessage(caught, '인증을 완료하지 못했습니다. 다시 시작해 주세요.'));
    } finally { if (operation === generation.current) { lock.current = false; setBusy(false); } }
  };

  const close = () => {
    if (busy) return;
    if (modal === 'password') { recovery.current = null; void savePending(null).catch(() => undefined); }
    setModal(null); setPassword(''); setConfirm(''); setError(null);
  };
  return <Context.Provider value={{ providers, busy, error, configurationError, configurationLoading, canRecover,
    refreshConfiguration: () => { if (!busy && !configurationLoading) setConfigurationRevision(value => value + 1); },
    startSocial, openRecovery: () => { if (!busy && canRecover && !token) { setError(null); setModal('request'); } } }}>
    {children}
    <Modal visible={modal !== null} onRequestClose={close} animationType="slide">
      <AppScreen scroll keyboardAware>
        <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>{t('비밀번호 재설정')}</Text>
          <Pressable accessibilityRole="button" onPress={close} disabled={busy} style={styles.close}><Text>{t('닫기')}</Text></Pressable></View>
        <Card>
          {modal === 'request' ? <><FormField label={t('이메일')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!busy} />
            <Button label={t('재설정 링크 보내기')} onPress={() => void requestRecovery()} loading={busy} disabled={!api || busy} /></> : null}
          {modal === 'sent' ? <><Text style={styles.copy}>{t('계정이 있으면 재설정 이메일을 보냈습니다. 이 기기에서 링크를 열어 주세요.')}</Text>
            <Button label={t('다시 요청')} variant="secondary" onPress={() => setModal('request')} /></> : null}
          {modal === 'password' ? <><FormField label={t('새 비밀번호')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" editable={!busy} />
            <FormField label={t('비밀번호 확인')} value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" editable={!busy} />
            <Text style={styles.copy}>{t('영문과 숫자를 포함한 8자 이상')}</Text>
            <Button label={t('비밀번호 변경')} onPress={() => void finishRecovery()} loading={busy} disabled={busy} /></> : null}
          {modal === 'done' ? <><Text style={styles.copy}>{t('비밀번호를 변경했습니다. 다시 로그인해 주세요.')}</Text>
            <Button label={t('로그인 화면으로 돌아가기')} onPress={close} /></> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text> : null}
        </Card>
      </AppScreen>
    </Modal>
  </Context.Provider>;
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing.lg },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 24, color: colors.text },
  close: { minWidth: 60, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  copy: { fontFamily: fonts.regular, color: colors.text, fontSize: 16, lineHeight: 24, marginBottom: spacing.md },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21, marginTop: spacing.md }
});
