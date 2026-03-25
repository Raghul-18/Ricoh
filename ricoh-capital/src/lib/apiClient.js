const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');
const AUTH_BASE = `${API_BASE}/auth`;

const TOKEN_KEY = 'rc_access_token';
const REFRESH_KEY = 'rc_refresh_token';

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
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

async function request(url, options = {}) {
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
  if (!res.ok) throw new Error(body?.error || body?.message || res.statusText);
  return body;
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
  const body = await request(`${AUTH_BASE}/session`);
  return body;
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
