import { ApiConfigurationError } from './errors';

export const DEFAULT_API_TIMEOUT_MS = 15_000;

export interface ApiRuntimeConfig {
  readonly baseUrl: string;
  readonly timeoutMs: number;
}

export interface ApiConfigOverrides {
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
}

function ipv4Octets(hostname: string): readonly number[] | null {
  const parts = hostname.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number);
  return octets.every((octet) => octet >= 0 && octet <= 255) ? octets : null;
}

function normalizeBaseUrl(rawValue: string | undefined): string {
  const raw = rawValue?.trim();
  if (!raw) {
    throw new ApiConfigurationError(
      'EXPO_PUBLIC_API_URL is missing. Set it to the V2 backend origin, for example https://api.example.com.',
    );
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ApiConfigurationError('EXPO_PUBLIC_API_URL must be an absolute HTTP(S) URL.');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ApiConfigurationError('EXPO_PUBLIC_API_URL must use HTTP or HTTPS.');
  }
  const hostname = url.hostname.toLowerCase();
  const ipv4 = ipv4Octets(hostname);
  const isLocalDevelopmentHost =
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname === '10.0.2.2' ||
    ipv4?.[0] === 127;
  const isPrivateLanHost =
    ipv4 !== null &&
    (ipv4[0] === 10 ||
      (ipv4[0] === 192 && ipv4[1] === 168) ||
      (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31));
  const isDevelopmentBuild =
    typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development';
  const allowsDevelopmentLanHttp =
    isDevelopmentBuild && isPrivateLanHost;
  if (url.protocol === 'http:' && !isLocalDevelopmentHost && !allowsDevelopmentLanHttp) {
    throw new ApiConfigurationError(
      'EXPO_PUBLIC_API_URL must use HTTPS outside localhost, an emulator, or a private LAN development host.',
    );
  }
  if (url.username || url.password) {
    throw new ApiConfigurationError('EXPO_PUBLIC_API_URL must not contain credentials.');
  }
  if (url.search || url.hash) {
    throw new ApiConfigurationError('EXPO_PUBLIC_API_URL must not contain a query or fragment.');
  }
  const normalizedPath = url.pathname.replace(/\/+$/, '') || '/';
  if (normalizedPath !== '/' && normalizedPath !== '/api') {
    throw new ApiConfigurationError(
      'EXPO_PUBLIC_API_URL may contain only the server origin or the exact /api path.',
    );
  }

  // Every API method owns its canonical /api prefix. Accept the backend
  // handoff's /api base form, but normalize it away to prevent /api/api routes.
  return url.origin;
}

function normalizeTimeout(value: number | undefined, envValue: string | undefined): number {
  const parsed = value ?? (envValue ? Number(envValue) : DEFAULT_API_TIMEOUT_MS);
  if (!Number.isInteger(parsed) || parsed < 1_000 || parsed > 60_000) {
    throw new ApiConfigurationError(
      'API timeout must be an integer between 1000 and 60000 milliseconds.',
    );
  }
  return parsed;
}

/**
 * Read and validate public Expo configuration. Explicit overrides make this
 * deterministic in unit tests and local Storybook/demo environments.
 */
export function resolveApiConfig(overrides: ApiConfigOverrides = {}): ApiRuntimeConfig {
  // Dot notation is intentional: Expo statically inlines EXPO_PUBLIC_* values.
  const environmentBaseUrl = process.env.EXPO_PUBLIC_API_URL;
  const environmentTimeout = process.env.EXPO_PUBLIC_API_TIMEOUT_MS;

  return {
    baseUrl: normalizeBaseUrl(overrides.baseUrl ?? environmentBaseUrl),
    timeoutMs: normalizeTimeout(overrides.timeoutMs, environmentTimeout),
  };
}
