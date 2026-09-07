import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

import type { ApiRuntimeConfig } from './config';
import { normalizeApiError, type ApiError } from './errors';

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
  let refreshPromise: Promise<string | null | undefined> | null = null;

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

      if (
        status === 401 &&
        authenticated?.refreshAccessToken &&
        failedRequest &&
        !failedRequest._shcRefreshAttempted
      ) {
        failedRequest._shcRefreshAttempted = true;
        let refreshedToken: string | null | undefined;
        try {
          if (!refreshPromise) {
            refreshPromise = Promise.resolve(authenticated.refreshAccessToken()).finally(() => {
              refreshPromise = null;
            });
          }
          refreshedToken = (await refreshPromise)?.trim();
        } catch {
          // A failed refresh falls through to the original 401 and clears the
          // unusable local session below.
        }
        if (refreshedToken) {
          failedRequest.headers.set('Authorization', `Bearer ${refreshedToken}`);
          // Keep replay outside the refresh catch. A cancellation or transient
          // failure after a successful refresh must reject as itself instead
          // of being replaced by the original 401 and logging the user out.
          return client.request(failedRequest);
        }
      }

      const normalized = normalizeApiError(error);
      if (normalized.status === 401 && authenticated?.onUnauthorized) {
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
