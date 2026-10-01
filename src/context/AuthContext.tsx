import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';

import {
  adaptUserProfile,
  ApiConfigurationError,
  createV2Api,
  customerSafeErrorMessage,
  type V2Api,
} from '../api';
import type {
  AuthSession,
  RegisterAccountInput,
  RegistrationResult,
  UserProfile,
} from '../domain';
import { createSessionTaskQueue } from '../auth/sessionTaskQueue';

const SESSION_KEY = 'shc.session';
const TOKEN_KEY = 'shc.accessToken';
const LEGACY_TOKEN_KEY = 'token';
const GUEST_ID_KEY = 'guestId';

export type ClientUser = UserProfile;

interface PersistedSession {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly expiresAt: number | null;
  readonly expiresIn: number | null;
  readonly user: UserProfile | null;
}

interface AuthContextType {
  token: string | null;
  currentUser: ClientUser | null;
  isLoading: boolean;
  isGuestMode: boolean;
  guestId: string | null;
  api: V2Api | null;
  configurationError: string | null;
  sessionError: string | null;
  setToken: (token: string | null) => Promise<void>;
  refreshProfile: () => Promise<ClientUser | null>;
  registerAccount: (input: RegisterAccountInput) => Promise<RegistrationResult>;
  loginEmail: (email: string, password: string) => Promise<void>;
  loginOAuth: (input: { provider: 'kakao' | 'apple' | 'google'; code: string; codeVerifier: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getWebSessionStorage(): Storage | null {
  if (Platform.OS !== 'web' || typeof globalThis === 'undefined') return null;
  return 'sessionStorage' in globalThis ? globalThis.sessionStorage : null;
}

function nullableFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parsePersistedSession(serialized: string | null): PersistedSession | null {
  if (!serialized) return null;
  try {
    const value: unknown = JSON.parse(serialized);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    if (typeof row.accessToken !== 'string' || !row.accessToken.trim()) return null;
    if (
      row.refreshToken !== undefined &&
      row.refreshToken !== null &&
      (typeof row.refreshToken !== 'string' || !row.refreshToken.trim())
    ) {
      return null;
    }
    return {
      accessToken: row.accessToken,
      refreshToken: typeof row.refreshToken === 'string' ? row.refreshToken : null,
      expiresAt: nullableFiniteNumber(row.expiresAt),
      expiresIn: nullableFiniteNumber(row.expiresIn),
      user:
        row.user === undefined || row.user === null
          ? null
          : adaptUserProfile(row.user, 'storedSession.user'),
    };
  } catch {
    return null;
  }
}

async function readStoredSession(): Promise<PersistedSession | null> {
  if (Platform.OS === 'web') {
    const storage = getWebSessionStorage();
    const session = parsePersistedSession(storage?.getItem(SESSION_KEY) ?? null);
    if (session) return session;
    const accessToken = storage?.getItem(TOKEN_KEY)?.trim();
    return accessToken
      ? { accessToken, refreshToken: null, expiresAt: null, expiresIn: null, user: null }
      : null;
  }

  const session = parsePersistedSession(await SecureStore.getItemAsync(SESSION_KEY));
  if (session) return session;
  const accessToken =
    (await SecureStore.getItemAsync(TOKEN_KEY)) ??
    (await SecureStore.getItemAsync(LEGACY_TOKEN_KEY));
  return accessToken?.trim()
    ? { accessToken, refreshToken: null, expiresAt: null, expiresIn: null, user: null }
    : null;
}

async function storeSession(session: AuthSession): Promise<void> {
  const serialized = JSON.stringify(session);
  if (Platform.OS === 'web') {
    const storage = getWebSessionStorage();
    storage?.setItem(SESSION_KEY, serialized);
    storage?.removeItem(TOKEN_KEY);
    return;
  }

  await SecureStore.setItemAsync(SESSION_KEY, serialized);
  // A complete session is authoritative only after SecureStore accepted it.
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined),
    SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY).catch(() => undefined),
  ]);
}

async function storeLegacyAccessToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    const storage = getWebSessionStorage();
    storage?.removeItem(SESSION_KEY);
    storage?.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined);
  await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY).catch(() => undefined);
}

async function removeStoredSession(): Promise<void> {
  if (Platform.OS === 'web') {
    const storage = getWebSessionStorage();
    storage?.removeItem(SESSION_KEY);
    storage?.removeItem(TOKEN_KEY);
    return;
  }

  await Promise.all([
    SecureStore.deleteItemAsync(SESSION_KEY),
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY),
  ]);
}

function errorMessage(error: unknown): string {
  return customerSafeErrorMessage(error, '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<ClientUser | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  const sessionRef = useRef<AuthSession | null>(null);
  const sessionGeneration = useRef(0);
  const storageQueue = useRef(createSessionTaskQueue());

  const clearSession = useCallback(async () => {
    sessionGeneration.current += 1;
    tokenRef.current = null;
    refreshTokenRef.current = null;
    sessionRef.current = null;
    setTokenState(null);
    setCurrentUser(null);
    setGuestId(null);
    setIsGuestMode(false);
    await storageQueue.current.run(async () => {
      await Promise.all([removeStoredSession(), AsyncStorage.removeItem(GUEST_ID_KEY)]);
    });
  }, []);

  const activateSession = useCallback(async (
    session: AuthSession,
    generation = sessionGeneration.current,
  ): Promise<void> => {
    // Persistence is the commit point: never expose a session that would be
    // lost on the next launch if SecureStore/sessionStorage rejects the write.
    await storageQueue.current.run(async () => {
      if (generation !== sessionGeneration.current) return;
      await storeSession(session);
      if (generation !== sessionGeneration.current) return;
      // Commit refs inside the queue so the next profile save sees these tokens.
      sessionRef.current = session;
      tokenRef.current = session.accessToken;
      refreshTokenRef.current = session.refreshToken;
      setTokenState(session.accessToken);
      setCurrentUser(session.user);
      setIsGuestMode(session.user.isGuest);
      setSessionError(null);
    });
  }, []);

  const apiResult = useMemo(() => {
    try {
      return {
        api: createV2Api({
          getAccessToken: () => tokenRef.current,
          getRefreshToken: () => refreshTokenRef.current,
          onSessionRefreshed: async (session) => {
            await activateSession(session);
          },
          onUnauthorized: async () => {
            setSessionError('세션이 만료되었습니다. 다시 로그인해 주세요.');
            await clearSession();
          },
        }),
        configurationError: null,
      };
    } catch (error) {
      return {
        api: null,
        configurationError: errorMessage(error),
      };
    }
  }, [activateSession, clearSession]);

  const requireApi = useCallback((): V2Api => {
    if (!apiResult.api) {
      throw new ApiConfigurationError(
        apiResult.configurationError ?? 'V2 API가 아직 설정되지 않았습니다.',
      );
    }
    return apiResult.api;
  }, [apiResult]);

  const refreshProfile = useCallback(async (): Promise<ClientUser | null> => {
    const api = requireApi();
    const generation = sessionGeneration.current;
    try {
      const profile = await api.profile.get();
      if (generation !== sessionGeneration.current) return null;
      return await storageQueue.current.run(async () => {
        if (generation !== sessionGeneration.current) return null;
        // Read the current credentials only after earlier refresh writes commit.
        const activeSession = sessionRef.current;
        if (activeSession) {
          const updatedSession = { ...activeSession, user: profile };
          await storeSession(updatedSession);
          if (generation !== sessionGeneration.current) return null;
          sessionRef.current = updatedSession;
        }
        setCurrentUser(profile);
        setIsGuestMode(profile.isGuest);
        setSessionError(null);
        return profile;
      });
    } catch (error) {
      if (generation === sessionGeneration.current) setSessionError(errorMessage(error));
      throw error;
    }
  }, [requireApi]);

  useEffect(() => {
    let active = true;
    const generation = sessionGeneration.current;

    const initialize = async () => {
      try {
        const [storedSession, storedGuest] = await Promise.all([
          readStoredSession(),
          AsyncStorage.getItem(GUEST_ID_KEY),
        ]);
        if (!active || generation !== sessionGeneration.current) return;

        // Keep saved credentials untouched when configuration is missing, but do
        // not expose a cached customer/admin session in unauthenticated preview.
        if (!apiResult.api) return;
        setGuestId(storedGuest);
        setIsGuestMode(Boolean(storedGuest));

        if (storedSession) {
          tokenRef.current = storedSession.accessToken;
          refreshTokenRef.current = storedSession.refreshToken;
          setTokenState(storedSession.accessToken);
          if (storedSession.user) {
            setCurrentUser(storedSession.user);
            setIsGuestMode(storedSession.user.isGuest);
          }
          if (storedSession.refreshToken && storedSession.user) {
            sessionRef.current = {
              accessToken: storedSession.accessToken,
              refreshToken: storedSession.refreshToken,
              expiresAt: storedSession.expiresAt,
              expiresIn: storedSession.expiresIn,
              user: storedSession.user,
            };
          }

          if (apiResult.api) {
            try {
              await refreshProfile();
            } catch (error) {
              if (!active || generation !== sessionGeneration.current) return;
              setSessionError(errorMessage(error));
            }
          }
        }
      } catch (error) {
        if (active && generation === sessionGeneration.current) setSessionError(errorMessage(error));
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void initialize();
    return () => {
      active = false;
    };
  }, [apiResult.api, refreshProfile]);

  const setToken = useCallback(
    async (nextToken: string | null) => {
      if (!nextToken) {
        await clearSession();
        return;
      }
      const generation = ++sessionGeneration.current;
      const saved = await storageQueue.current.run(async () => {
        if (generation !== sessionGeneration.current) return false;
        await storeLegacyAccessToken(nextToken);
        return generation === sessionGeneration.current;
      });
      if (!saved) return;
      sessionRef.current = null;
      refreshTokenRef.current = null;
      tokenRef.current = nextToken;
      setTokenState(nextToken);
      setCurrentUser(null);
      setGuestId(null);
      setIsGuestMode(false);
    },
    [clearSession],
  );

  const registerAccount = useCallback(
    async (input: RegisterAccountInput) => {
      const generation = ++sessionGeneration.current;
      setSessionError(null);
      const result = await requireApi().auth.register(input);
      if (result.accessToken && result.refreshToken && result.user) {
        await activateSession({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresAt: result.expiresAt,
          expiresIn: result.expiresIn,
          user: result.user,
        }, generation);
      }
      return result;
    },
    [activateSession, requireApi],
  );

  const loginEmail = useCallback(
    async (email: string, password: string) => {
      const generation = ++sessionGeneration.current;
      setSessionError(null);
      const session = await requireApi().auth.login({
        email: email.trim().toLowerCase(),
        password,
      });
      await activateSession(session, generation);
    },
    [activateSession, requireApi],
  );

  const logout = useCallback(async () => {
    setSessionError(null);
    try {
      if (tokenRef.current && apiResult.api) {
        await apiResult.api.auth.logout();
      }
    } catch {
      // A network/server revocation failure must never trap the user locally.
    } finally {
      await clearSession();
    }
  }, [apiResult.api, clearSession]);

  const loginOAuth = useCallback(async (input: { provider: 'kakao' | 'apple' | 'google'; code: string; codeVerifier: string }) => {
    const generation = ++sessionGeneration.current;
    setSessionError(null);
    const session = await requireApi().auth.exchangeOAuth(input);
    await activateSession(session, generation);
  }, [activateSession, requireApi]);

  const value = useMemo<AuthContextType>(
    () => ({
      token,
      currentUser,
      isLoading,
      isGuestMode,
      guestId,
      api: apiResult.api,
      configurationError: apiResult.configurationError,
      sessionError,
      setToken,
      refreshProfile,
      registerAccount,
      loginEmail,
      loginOAuth,
      logout,
    }),
    [
      apiResult,
      currentUser,
      guestId,
      isGuestMode,
      isLoading,
      loginEmail,
      loginOAuth,
      logout,
      refreshProfile,
      registerAccount,
      sessionError,
      setToken,
      token,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
