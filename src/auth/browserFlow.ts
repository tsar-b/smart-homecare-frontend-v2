export type SocialProvider = 'kakao' | 'apple' | 'google';
export type PendingAuthFlow = {
  kind: 'oauth' | 'recovery'; provider?: SocialProvider; verifier: string;
  state: string; redirectUri: string; createdAt: number;
};
export const AUTH_FLOW_MAX_AGE_MS = 30 * 60 * 1000;

export function parsePendingFlow(raw: string | null, now = Date.now()): PendingAuthFlow | null {
  if (!raw) return null;
  try {
    const item = JSON.parse(raw) as PendingAuthFlow;
    if (!['oauth', 'recovery'].includes(item.kind) ||
        !/^[a-f0-9]{64}$/.test(item.state) || !/^[a-f0-9]{64}$/.test(item.verifier) ||
        !Number.isFinite(item.createdAt) || item.createdAt > now || now - item.createdAt > AUTH_FLOW_MAX_AGE_MS ||
        (item.kind === 'oauth' && !['kakao', 'apple', 'google'].includes(item.provider ?? ''))) return null;
    const uri = new URL(item.redirectUri);
    const localHttp = uri.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(uri.hostname);
    if (uri.search || uri.hash || uri.username || uri.password ||
        !(uri.protocol === 'https:' || uri.protocol === 'smarthomecareapplication:' || localHttp)) return null;
    return item;
  } catch { return null; }
}

export function parseAuthCallback(raw: string, flow: PendingAuthFlow, now = Date.now()): { code: string } {
  if (!parsePendingFlow(JSON.stringify(flow), now)) throw new Error('AUTH_LINK_EXPIRED');
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('AUTH_CALLBACK_INVALID'); }
  const target = new URL(flow.redirectUri);
  if (url.protocol !== target.protocol || url.host !== target.host || url.pathname !== target.pathname ||
      url.username || url.password || url.searchParams.getAll('state').length !== 1 ||
      url.searchParams.get('state') !== flow.state) throw new Error('AUTH_CALLBACK_INVALID');
  const errorFields = new Set(['error', 'error_code', 'error_description']);
  const uniqueFields = (params: URLSearchParams) =>
    Array.from(params.keys()).every(key => params.getAll(key).length === 1);
  const isErrorOnly = (params: URLSearchParams, allowState: boolean, allowEmptyMarker = false) =>
    uniqueFields(params) && Array.from(params.keys()).every(key =>
      errorFields.has(key) || (allowState && key === 'state') ||
      (allowEmptyMarker && key === 'sb' && params.get(key) === '')) &&
    Boolean(params.get('error') || params.get('error_code'));
  if (!uniqueFields(url.searchParams)) throw new Error('AUTH_CALLBACK_INVALID');
  if (url.hash) {
    // Supabase can duplicate denial fields in the query and fragment, with an
    // empty "sb" marker. Duplicates must agree; the state stays in the query.
    // Never accept implicit-flow tokens or authorization codes in the fragment.
    const fragment = new URLSearchParams(url.hash.slice(1));
    const queryHasErrors = Array.from(errorFields).some(key => url.searchParams.has(key));
    if (!isErrorOnly(fragment, false, true) ||
        (queryHasErrors ? !isErrorOnly(url.searchParams, true) :
          Array.from(url.searchParams.keys()).some(key => key !== 'state')) ||
        Array.from(errorFields).some(key => url.searchParams.has(key) && fragment.has(key) &&
          url.searchParams.get(key) !== fragment.get(key))) throw new Error('AUTH_CALLBACK_INVALID');
    throw new Error('AUTH_PROVIDER_CANCELLED');
  }
  if (Array.from(errorFields).some(key => url.searchParams.has(key))) {
    if (!isErrorOnly(url.searchParams, true)) throw new Error('AUTH_CALLBACK_INVALID');
    throw new Error('AUTH_PROVIDER_CANCELLED');
  }
  const code = url.searchParams.get('code');
  if (!code || code.length > 2048 || url.searchParams.getAll('code').length !== 1 ||
      url.searchParams.has('access_token') || url.searchParams.has('refresh_token')) throw new Error('AUTH_CALLBACK_INVALID');
  return { code };
}

export function recoveryPasswordError(password: string, confirm: string): 'weak' | 'mismatch' | null {
  if (password.length < 8 || password.length > 200 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'weak';
  return password === confirm ? null : 'mismatch';
}
