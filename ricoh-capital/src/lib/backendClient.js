import {
  authGetMe,
  authGetSession,
  authConsumeOnboardingToken,
  authSignIn,
  authSignOut,
  authSignUp,
  callApiEndpoint,
  callAdminEndpoint,
  convertFxAmount,
  getFxRate,
  getSignedFileUrl,
  queryTable,
  requestPasswordReset,
  uploadFile,
  updatePassword,
} from './apiClient';

const listeners = new Set();

function notifyAuth(event, session) {
  listeners.forEach((cb) => cb(event, session));
}

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this._select = '*';
    this._filters = [];
    this._orderBy = null;
    this._single = false;
    this._maybeSingle = false;
    this._action = 'select';
    this._values = null;
  }

  select(columns = '*') { this._select = columns; return this; }
  eq(column, value) { this._filters.push({ op: 'eq', column, value }); return this; }
  neq(column, value) { this._filters.push({ op: 'neq', column, value }); return this; }
  in(column, value) { this._filters.push({ op: 'in', column, value }); return this; }
  order(column, options = {}) { this._orderBy = { column, ascending: options.ascending !== false }; return this; }
  single() { this._single = true; return this; }
  maybeSingle() { this._maybeSingle = true; return this; }
  insert(values) { this._action = 'insert'; this._values = values; return this; }
  update(values) { this._action = 'update'; this._values = values; return this; }
  delete() { this._action = 'delete'; return this; }

  async execute() {
    try {
      const result = await queryTable({
        table: this.table,
        action: this._action,
        select: this._select,
        values: this._values,
        filters: this._filters,
        orderBy: this._orderBy,
        single: this._single,
        maybeSingle: this._maybeSingle,
      });
      return { data: result.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  then(resolve, reject) { return this.execute().then(resolve, reject); }
}

export const authClient = {
  async getSession() {
    const result = await authGetSession();
    return {
      data: {
        session: result.session
          ? { access_token: result.session.access_token, user: result.user }
          : null,
      },
    };
  },
  async getUser() {
    const user = await authGetMe();
    return { data: { user } };
  },
  async signInWithPassword({ email, password }) {
    const result = await authSignIn(email, password);
    notifyAuth('SIGNED_IN', {
      ...result.session,
      user: result.user,
    });
    return { data: result, error: null };
  },
  async signUp(payload) {
    const normalized = {
      email: payload.email,
      password: payload.password,
      fullName: payload?.options?.data?.full_name || payload.fullName,
      companyName: payload?.options?.data?.company_name || payload.companyName,
      role: payload?.options?.data?.role || payload.role || 'originator',
      languageCode: payload?.options?.data?.language_code || payload.languageCode,
      localeCode: payload?.options?.data?.locale_code || payload.localeCode,
      primaryCurrencyCode: payload?.options?.data?.primary_currency_code || payload.primaryCurrencyCode,
    };
    const result = await authSignUp(normalized);
    notifyAuth('SIGNED_IN', {
      ...result.session,
      user: result.user,
    });
    return { data: result, error: null };
  },
  async signInWithOnboardingToken(token) {
    const result = await authConsumeOnboardingToken(token);
    notifyAuth('SIGNED_IN', {
      ...result.session,
      user: result.user,
    });
    return { data: result, error: null };
  },
  async signOut() {
    await authSignOut();
    notifyAuth('SIGNED_OUT', null);
    return { error: null };
  },
  onAuthStateChange(callback) {
    listeners.add(callback);
    return {
      data: { subscription: { unsubscribe: () => listeners.delete(callback) } },
    };
  },
  async refreshSession() {
    const { data } = await this.getSession();
    return { data, error: null };
  },
  async resetPasswordForEmail(email) {
    return { error: null, data: await requestPasswordReset(email) };
  },
  async updateUser(payload) {
    return { error: null, data: await updatePassword(payload.password) };
  },
  async exchangeCodeForSession() {
    return { error: null };
  },
};

export const realtimeClient = {
  channel() {
    return {
      on() { return this; },
      subscribe() { return { unsubscribe: () => undefined }; },
    };
  },
  removeChannel() {},
};

export const db = {
  profiles: () => new QueryBuilder('profiles'),
  applications: () => new QueryBuilder('originator_applications'),
  documents: () => new QueryBuilder('originator_documents'),
  checks: () => new QueryBuilder('verification_checks'),
  deals: () => new QueryBuilder('deals'),
  contracts: () => new QueryBuilder('contracts'),
  paymentSchedule: () => new QueryBuilder('payment_schedule'),
  prospects: () => new QueryBuilder('prospects'),
  activities: () => new QueryBuilder('prospect_activities'),
  quotes: () => new QueryBuilder('quotes'),
  notifications: () => new QueryBuilder('notifications'),
  auditLogs: () => new QueryBuilder('audit_logs'),
  amendments: () => new QueryBuilder('deal_amendments'),
  contractSignatures: () => new QueryBuilder('contract_signatures'),
  contractClosureRequests: () => new QueryBuilder('contract_closure_requests'),
  customerAccessCredentials: () => new QueryBuilder('customer_access_credentials'),
};

export const fxClient = {
  getRate: (baseCurrency, targetCurrency) => getFxRate(baseCurrency, targetCurrency),
  convert: (amount, baseCurrency, targetCurrency) => convertFxAmount(amount, baseCurrency, targetCurrency),
};

export async function uploadDocument(userId, documentType, file, onProgress) {
  onProgress?.(10);
  const data = await uploadFile({ file, documentType });
  onProgress?.(100);
  return { path: data.path, fullPath: data.path };
}

export async function getDocumentSignedUrl(filePath) {
  if (!filePath) return null;
  try {
    return await getSignedFileUrl(filePath, 3600);
  } catch (error) {
    console.error('Signed URL error:', error);
    return null;
  }
}

export async function getDocumentSignedUrls(filePaths) {
  if (!filePaths?.length) return {};
  const entries = await Promise.all(filePaths.map(async (p) => [p, await getDocumentSignedUrl(p)]));
  return Object.fromEntries(entries);
}

export async function downloadDocumentBlob(filePath) {
  const signed = await getDocumentSignedUrl(filePath);
  const res = await fetch(signed);
  if (!res.ok) throw new Error('Failed to download file');
  return res.blob();
}

export async function invokeAdminFunction(name, body = {}) {
  return callAdminEndpoint(name, body);
}

export async function invokeApi(path, body = {}, method = 'POST') {
  return callApiEndpoint(path, body, method);
}

export async function logAudit(entityType, entityId, action, details = {}) {
  await callApiEndpoint('/audit/log', {
    entityType,
    entityId,
    action,
    details,
  });
}
