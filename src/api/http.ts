import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

import type { ApiRuntimeConfig } from './config';
import { normalizeApiError, ApiError } from './errors';

export type AccessTokenProvider = () =>
  | string
  | null
  | undefined
  | Promise<string | null | undefined>;

export type UnauthorizedHandler = (error: ApiError) => void | Promise<void>;
export type AccessTokenRefreshHandler = () =>
  | string
  | null
  | undefined
  | Promise<string | null | undefined>;

export interface AuthenticatedHttpOptions {
  readonly getAccessToken: AccessTokenProvider;
  readonly refreshAccessToken?: AccessTokenRefreshHandler;
  readonly onUnauthorized?: UnauthorizedHandler;
}

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _shcRefreshAttempted?: boolean;
}

export interface MutableAccessTokenSource {
  readonly getAccessToken: AccessTokenProvider;
  readonly setAccessToken: (token: string | null) => void;
  readonly clearAccessToken: () => void;
}

/**
 * A small in-memory source useful while wiring AuthContext. Persistence should
 * remain in SecureStore on native and a secure server session on web.
 */
export function createMutableAccessTokenSource(
  initialToken: string | null = null,
): MutableAccessTokenSource {
  let accessToken = initialToken;
  return {
    getAccessToken: () => accessToken,
    setAccessToken: (token) => {
      accessToken = token;
    },
    clearAccessToken: () => {
      accessToken = null;
    },
  };
}

export function createHttpClient(
  config: ApiRuntimeConfig,
  authenticated?: AuthenticatedHttpOptions,
): AxiosInstance {
  const client = axios.create({
    baseURL: config.baseUrl,
    timeout: config.timeoutMs,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
  const refreshPromises = new Map<string, Promise<string | null | undefined>>();

  if (authenticated) {
    client.interceptors.request.use(async (request) => {
      const token = (await authenticated.getAccessToken())?.trim();
      if (token && !request.headers.has('Authorization')) {
        request.headers.set('Authorization', `Bearer ${token}`);
      }
      return request;
    });
  }

  client.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      const failedRequest = axios.isAxiosError(error)
        ? (error.config as RetryableRequestConfig | undefined)
        : undefined;
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const requestToken = failedRequest?.headers.get('Authorization');
      const sessionStillMatches = async () => {
        const currentToken = (await authenticated?.getAccessToken())?.trim();
        return Boolean(currentToken && requestToken === `Bearer ${currentToken}`);
      };
      const cancelled = () => new ApiError({ code: 'REQUEST_CANCELLED', message: 'Request was cancelled' });

      if (failedRequest?.signal?.aborted) return Promise.reject(cancelled());
      // A late response from a logged-out/replaced account cannot invalidate
      // or replay a request using the new account's credentials.
      if (status === 401 && authenticated && !(await sessionStillMatches())) {
        return Promise.reject(normalizeApiError(error));
      }

      if (
        status === 401 &&
        authenticated?.refreshAccessToken &&
        failedRequest &&
        !failedRequest._shcRefreshAttempted
      ) {
        failedRequest._shcRefreshAttempted = true;
        let refreshedToken: string | null | undefined;
        try {
          const refreshKey = String(requestToken);
          let refreshPromise = refreshPromises.get(refreshKey);
          if (!refreshPromise) {
            refreshPromise = Promise.resolve(authenticated.refreshAccessToken()).finally(() => {
              if (refreshPromises.get(refreshKey) === refreshPromise) refreshPromises.delete(refreshKey);
            });
            refreshPromises.set(refreshKey, refreshPromise);
          }
          refreshedToken = (await refreshPromise)?.trim();
        } catch (refreshError) {
          const refreshFailure = normalizeApiError(refreshError);
          // Offline/timeout/rate-limit/server failures do not establish that
          // the refresh token is invalid. Preserve the session for retry.
          if (refreshFailure.status !== 401) return Promise.reject(refreshFailure);
        }
        if (failedRequest.signal?.aborted) return Promise.reject(cancelled());
        if (refreshedToken) {
          if ((await authenticated.getAccessToken())?.trim() !== refreshedToken) {
            return Promise.reject(normalizeApiError(error));
          }
          failedRequest.headers.set('Authorization', `Bearer ${refreshedToken}`);
          // Keep replay outside the refresh catch. A cancellation or transient
          // failure after a successful refresh must reject as itself instead
          // of being replaced by the original 401 and logging the user out.
          return client.request(failedRequest);
        }
      }

      const normalized = normalizeApiError(error);
      if (normalized.status === 401 && authenticated?.onUnauthorized && await sessionStillMatches()) {
        try {
          await authenticated.onUnauthorized(normalized);
        } catch {
          // Session cleanup must never obscure the original request failure.
        }
      }
      return Promise.reject(normalized);
    },
  );

  return client;
}
