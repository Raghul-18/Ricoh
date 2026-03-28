const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');
const AUTH_BASE = `${API_BASE}/auth`;
const FX_FALLBACK_BASE = 'https://api.frankfurter.dev/v1';

const TOKEN_KEY = 'rc_access_token';
const REFRESH_KEY = 'rc_refresh_token';
let refreshPromise = null;

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY) || '';
}

function setTokens(session) {
  if (!session) return;
  if (session.access_token) localStorage.setItem(TOKEN_KEY, session.access_token);
  if (session.refresh_token) localStorage.setItem(REFRESH_KEY, session.refresh_token);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('Missing refresh token');

  refreshPromise = (async () => {
    const res = await fetch(`${AUTH_BASE}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.access_token) {
      clearTokens();
      throw new Error((body && body.error) || 'Invalid refresh token');
    }
    setTokens({ access_token: body.access_token, refresh_token: refreshToken });
    return body.access_token;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function request(url, options = {}, attempt = 0) {
  const token = getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const message =
      (typeof body?.error === 'string' && body.error) ||
      body?.error?.message ||
      (typeof body?.message === 'string' && body.message) ||
      body?.message?.message ||
      res.statusText;
    if (res.status === 401 && message === 'Invalid token' && attempt === 0 && getRefreshToken()) {
      await refreshAccessToken();
      return request(url, options, attempt + 1);
    }
    throw new Error(message);
  }
  return body;
}

async function requestJson(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.json();
  if (!res.ok) {
    const message =
      (typeof body?.error === 'string' && body.error) ||
      body?.message ||
      res.statusText;
    throw new Error(message);
  }
  return body;
}

async function fetchFxFallbackRate(baseCurrency, targetCurrency) {
  const base = String(baseCurrency || '').toUpperCase();
  const target = String(targetCurrency || '').toUpperCase();
  if (!base || !target) throw new Error('Both base and target currency are required');
  if (base === target) {
    return {
      baseCurrency: base,
      targetCurrency: target,
      rate: 1,
      fetchedAt: new Date().toISOString(),
      source: 'frankfurter-browser',
    };
  }

  const payload = await requestJson(`${FX_FALLBACK_BASE}/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(target)}`);
  const rate = Number(payload?.rates?.[target]);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('FX fallback did not return a valid rate');
  }
  return {
    baseCurrency: base,
    targetCurrency: target,
    rate,
    fetchedAt: payload?.date ? new Date(`${payload.date}T00:00:00.000Z`).toISOString() : new Date().toISOString(),
    source: 'frankfurter-browser',
  };
}

export async function authSignIn(email, password) {
  const body = await request(`${AUTH_BASE}/signin`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setTokens(body.session);
  return body;
}

export async function authSignUp(payload) {
  const body = await request(`${AUTH_BASE}/signup`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setTokens(body.session);
  return body;
}

export async function authGetSession() {
  const token = getAccessToken();
  if (!token) return { user: null, session: null };
  try {
    const body = await request(`${AUTH_BASE}/session`);
    return body;
  } catch (error) {
    if (error.message === 'Invalid token') {
      clearTokens();
      return { user: null, session: null };
    }
    throw error;
  }
}

export async function authGetMe() {
  return request(`${AUTH_BASE}/me`);
}

export async function authSignOut() {
  clearTokens();
  return { ok: true };
}

export async function requestPasswordReset(email) {
  return request(`${AUTH_BASE}/reset-password-request`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function updatePassword(password) {
  return request(`${AUTH_BASE}/update-password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function queryTable(payload) {
  return request(`${API_BASE}/query`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadFile({ file, documentType }) {
  const form = new FormData();
  form.set('file', file);
  form.set('documentType', documentType);
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/files/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error || 'Upload failed');
  return body;
}

export async function getSignedFileUrl(path, expiresIn = 3600) {
  const token = getAccessToken();
  const res = await fetch(
    `${API_BASE}/files/signed-url?path=${encodeURIComponent(path)}&expiresIn=${expiresIn}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error || 'Failed to generate signed URL');
  return `${API_ORIGIN}${body.signedUrl}`;
}

export async function callAdminEndpoint(name, payload) {
  return request(`${API_BASE}/admin/${name}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function authConsumeOnboardingToken(token) {
  const body = await request(`${AUTH_BASE}/onboard/consume`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  setTokens(body.session);
  return body;
}

export async function callApiEndpoint(path, payload, method = 'POST') {
  return request(`${API_BASE}${path}`, {
    method,
    body: payload == null ? undefined : JSON.stringify(payload),
  });
}

export async function getFxRate(baseCurrency, targetCurrency) {
  try {
    return await fetchFxFallbackRate(baseCurrency, targetCurrency);
  } catch (error) {
    console.warn('Browser FX rate failed, falling back to backend FX provider:', error.message);
    return request(`${API_BASE}/fx/rate?base=${encodeURIComponent(baseCurrency)}&target=${encodeURIComponent(targetCurrency)}`);
  }
}

export async function convertFxAmount(amount, baseCurrency, targetCurrency) {
  try {
    const fx = await fetchFxFallbackRate(baseCurrency, targetCurrency);
    const numericAmount = Number(amount || 0);
    return {
      ...fx,
      amount: numericAmount,
      convertedAmount: Math.round(numericAmount * fx.rate * 100) / 100,
    };
  } catch (error) {
    console.warn('Browser FX convert failed, falling back to backend FX provider:', error.message);
    return request(`${API_BASE}/fx/convert`, {
      method: 'POST',
      body: JSON.stringify({ amount, baseCurrency, targetCurrency }),
    });
  }
}
