const rawBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

if (!rawBaseUrl) {
  throw new Error(
    'EXPO_PUBLIC_API_URL is required, for example http://127.0.0.1:5050',
  );
}

const parsedBaseUrl = new URL(rawBaseUrl);
if (!['http:', 'https:'].includes(parsedBaseUrl.protocol)) {
  throw new Error('EXPO_PUBLIC_API_URL must use HTTP or HTTPS');
}
if (parsedBaseUrl.username || parsedBaseUrl.password) {
  throw new Error('EXPO_PUBLIC_API_URL must not contain credentials');
}
if (parsedBaseUrl.search || parsedBaseUrl.hash) {
  throw new Error('EXPO_PUBLIC_API_URL must not contain a query or fragment');
}

const normalizedPath = parsedBaseUrl.pathname.replace(/\/+$/, '');
if (normalizedPath && normalizedPath !== '/api') {
  throw new Error('EXPO_PUBLIC_API_URL may contain only an optional /api suffix');
}
parsedBaseUrl.pathname = '';
const origin = parsedBaseUrl.origin;

async function readJson(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${origin}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`${path} returned non-JSON content with HTTP ${response.status}`);
    }
    if (!response.ok) {
      const code = body && typeof body === 'object' ? body.code : undefined;
      throw new Error(`${path} failed with HTTP ${response.status}${code ? ` (${code})` : ''}`);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function requireArray(record, key, path) {
  const value = record?.[key];
  if (!Array.isArray(value)) {
    throw new Error(`${path}.${key} must be an array`);
  }
  return value;
}

const [health, readiness, openapi, initialization, availability] = await Promise.all([
  readJson('/health'),
  readJson('/ready'),
  readJson('/openapi.json'),
  readJson('/api/app/initialize'),
  readJson('/api/bookings/availability?date=2099-12-31'),
]);

if (health.ok !== true) throw new Error('/health did not report ok');
if (
  readiness.ok !== true ||
  readiness.dependencies?.supabaseAuth !== true ||
  readiness.dependencies?.supabaseDatabase !== true
) {
  throw new Error('/ready did not confirm both Supabase dependencies');
}
if (openapi.openapi !== '3.1.0' || !openapi.paths) {
  throw new Error('/openapi.json did not return the expected OpenAPI contract');
}

const catalog = initialization.catalog;
const summary = {
  origin,
  openApiPaths: Object.keys(openapi.paths).length,
  catalog: {
    categories: requireArray(catalog, 'categories', 'catalog').length,
    serviceTypes: requireArray(catalog, 'serviceTypes', 'catalog').length,
    subtypes: requireArray(catalog, 'subtypes', 'catalog').length,
    pricingTiers: requireArray(catalog, 'pricingTiers', 'catalog').length,
    options: requireArray(catalog, 'options', 'catalog').length,
    assets: requireArray(catalog, 'assets', 'catalog').length,
  },
  availabilitySlots: requireArray({ availability }, 'availability', 'response').length,
};

console.log(JSON.stringify(summary, null, 2));
