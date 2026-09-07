import axios from 'axios';

import type { ApiErrorDto } from './contracts';

export class ApiConfigurationError extends Error {
  readonly code = 'API_CONFIGURATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'ApiConfigurationError';
  }
}

export class ApiContractError extends Error {
  readonly code = 'API_CONTRACT_ERROR';
  readonly path: string;

  constructor(path: string, expectation: string) {
    super(`Invalid API response at ${path}: expected ${expectation}`);
    this.name = 'ApiContractError';
    this.path = path;
  }
}

export class ApiError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(args: {
    message: string;
    status?: number | null;
    code?: string;
    details?: unknown;
    requestId?: string | null;
    retryAfterSeconds?: number | null;
  }) {
    super(args.message);
    this.name = 'ApiError';
    this.status = args.status ?? null;
    this.code = args.code ?? 'API_ERROR';
    this.details = args.details;
    this.requestId = args.requestId ?? null;
    this.retryAfterSeconds = args.retryAfterSeconds ?? null;
  }
}

/**
 * Convert an internal failure into copy that is safe to render to a customer.
 *
 * ApiError still retains its status, code, request ID, and structured details
 * for control flow and diagnostics. Backend/Supabase messages are deliberately
 * not returned because they may contain implementation or database details.
 */
export function customerSafeErrorMessage(
  error: unknown,
  fallback = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
): string {
  if (error instanceof ApiConfigurationError) {
    return '서버 연결 설정이 필요합니다.';
  }

  if (!(error instanceof ApiError)) return fallback;
  if (error.code === 'REQUEST_CANCELLED') return '';
  if (error.code === 'NETWORK_ERROR') {
    return '서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.';
  }
  if (error.code === 'EMAIL_CONFIRMATION_REQUIRED') {
    return '가입 이메일의 확인 링크를 연 뒤 다시 로그인해 주세요.';
  }
  if (error.status === 401) {
    return '로그인 정보가 올바르지 않거나 세션이 만료되었습니다.';
  }
  if (error.status === 403) {
    return '이 작업을 수행할 권한이 없습니다.';
  }
  if (error.status === 404) {
    return '요청한 정보를 찾을 수 없습니다.';
  }
  if (error.status === 409) {
    return '이미 처리된 정보이거나 현재 상태와 충돌합니다. 내용을 확인해 주세요.';
  }
  if (error.status === 429) {
    return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (error.status === 400 || error.status === 422) {
    return '입력 내용을 확인해 주세요.';
  }
  if (error.status !== null && error.status >= 500) {
    return '서버에서 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function retryAfterSeconds(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** Convert Axios failures to a small, redacted error safe for UI handling. */
export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (!axios.isAxiosError(error)) {
    return new ApiError({
      code: 'UNEXPECTED_CLIENT_ERROR',
      message: 'The app could not complete the request',
    });
  }

  if (error.code === 'ERR_CANCELED') {
    return new ApiError({ code: 'REQUEST_CANCELLED', message: 'Request was cancelled' });
  }

  const responseBody: ApiErrorDto = isRecord(error.response?.data)
    ? error.response.data
    : {};
  const status = error.response?.status ?? null;
  // Never promote an arbitrary backend/Supabase message to Error.message.
  // Callers use code/status for special cases and customerSafeErrorMessage for UI.
  const message = status === null
    ? 'Unable to reach the server'
    : 'The server rejected the request';

  return new ApiError({
    status,
    code:
      optionalString(responseBody.code) ??
      (status === null ? 'NETWORK_ERROR' : `HTTP_${status}`),
    message,
    details: responseBody.details,
    requestId: optionalString(responseBody.requestId),
    retryAfterSeconds: retryAfterSeconds(error.response?.headers?.['retry-after']),
  });
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
