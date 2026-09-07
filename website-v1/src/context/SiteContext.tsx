import {
  createContext,
  type FormEvent,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { previewInitialization } from '../content';
import {
  apiMode,
  fetchInitialization,
  loginAccount,
  registerAccount,
  type ShcApiError,
} from '../api/shcApi';
import type {
  AppInitialization,
  AuthSession,
  CatalogSource,
  Locale,
} from '../types';

interface LoginInput {
  readonly email: string;
  readonly password: string;
}

interface RegisterInput extends LoginInput {
  readonly name: string;
  readonly phone?: string;
}

interface SiteContextValue {
  readonly locale: Locale;
  readonly setLocale: (locale: Locale) => void;
  readonly initialization: AppInitialization;
  readonly catalogSource: CatalogSource;
  readonly catalogError: string | null;
  readonly reloadCatalog: () => void;
  readonly session: AuthSession | null;
  readonly authPending: boolean;
  readonly authMessage: string | null;
  readonly login: (input: LoginInput) => Promise<AuthSession>;
  readonly register: (input: RegisterInput) => Promise<AuthSession>;
  readonly logout: () => void;
}

const SiteContext = createContext<SiteContextValue | null>(null);

function initialLocale(): Locale {
  if (typeof window === 'undefined') return 'ko';
  const stored = window.localStorage.getItem('shc-locale');
  if (stored === 'ko' || stored === 'en') return stored;
  return window.navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return '요청을 완료하지 못했습니다.';
}

export function SiteProvider({ children }: PropsWithChildren) {
  const [locale, updateLocale] = useState<Locale>(initialLocale);
  const [initialization, setInitialization] = useState<AppInitialization>(previewInitialization);
  const [catalogSource, setCatalogSource] = useState<CatalogSource>(
    apiMode === 'preview' ? 'preview' : 'loading',
  );
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authPending, setAuthPending] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const setLocale = useCallback((next: Locale) => {
    updateLocale(next);
    window.localStorage.setItem('shc-locale', next);
    document.documentElement.lang = next;
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (apiMode === 'preview') {
      setInitialization(previewInitialization);
      setCatalogSource('preview');
      return;
    }
    const controller = new AbortController();
    setCatalogSource('loading');
    setCatalogError(null);
    void fetchInitialization(controller.signal)
      .then((payload) => {
        if (!payload.catalog.serviceTypes.length) {
          throw new Error('연결된 카탈로그에 서비스 항목이 없습니다.');
        }
        setInitialization(payload);
        setCatalogSource('live');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setCatalogError(errorMessage(error));
        if (apiMode === 'live') {
          setCatalogSource('error');
          return;
        }
        setInitialization(previewInitialization);
        setCatalogSource('preview');
      });
    return () => controller.abort();
  }, [catalogAttempt]);

  const reloadCatalog = useCallback(() => setCatalogAttempt((value) => value + 1), []);

  const login = useCallback(async (input: LoginInput) => {
    setAuthPending(true);
    setAuthMessage(null);
    try {
      const nextSession = await loginAccount(input);
      if (!nextSession.accessToken) {
        throw new Error('로그인 응답에 액세스 토큰이 없습니다.');
      }
      setSession(nextSession);
      setAuthMessage('로그인되었습니다. 이 탭을 닫거나 새로고침하면 세션이 초기화됩니다.');
      return nextSession;
    } catch (error) {
      setAuthMessage(errorMessage(error));
      throw error;
    } finally {
      setAuthPending(false);
    }
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    setAuthPending(true);
    setAuthMessage(null);
    try {
      const nextSession = await registerAccount(input);
      if (nextSession.accessToken) setSession(nextSession);
      setAuthMessage(
        nextSession.requiresEmailConfirmation
          ? '확인 메일을 보냈습니다. 이메일 확인 후 로그인해 주세요.'
          : '계정이 생성되었습니다.',
      );
      return nextSession;
    } catch (error) {
      setAuthMessage(errorMessage(error));
      throw error;
    } finally {
      setAuthPending(false);
    }
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    setAuthMessage(null);
  }, []);

  const value = useMemo<SiteContextValue>(
    () => ({
      locale,
      setLocale,
      initialization,
      catalogSource,
      catalogError,
      reloadCatalog,
      session,
      authPending,
      authMessage,
      login,
      register,
      logout,
    }),
    [
      authMessage,
      authPending,
      catalogError,
      catalogSource,
      initialization,
      locale,
      login,
      logout,
      register,
      reloadCatalog,
      session,
      setLocale,
    ],
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteContextValue {
  const context = useContext(SiteContext);
  if (!context) throw new Error('useSite must be used inside SiteProvider');
  return context;
}

// Kept as a type-only utility for form components that forward native submit events.
export type SubmitEvent = FormEvent<HTMLFormElement>;
export type ApiFailure = ShcApiError;
