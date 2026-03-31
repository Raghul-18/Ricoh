import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import oracledb from 'oracledb';
import { env } from '../config/env.js';
import { withConnection } from '../db/oracle.js';
import { isOnboardingOnlyPasswordPlaceholder } from './onboardingPassword.js';

const PASSWORD_POLICY = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;

export function issueSessionTokens(user) {
  const baseClaims = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };
  return {
    accessToken: jwt.sign(baseClaims, env.jwt.accessSecret, { expiresIn: env.jwt.accessTtl }),
    refreshToken: jwt.sign({ sub: user.id, typ: 'refresh' }, env.jwt.refreshSecret, {
      expiresIn: env.jwt.refreshTtl,
    }),
  };
}

function normalizeRow(row) {
  return {
    id: Buffer.isBuffer(row.ID) ? row.ID.toString('hex') : row.ID,
    email: row.EMAIL,
    role: row.ROLE,
    full_name: row.FULL_NAME,
    company_name: row.COMPANY_NAME,
    onboarding_status: row.ONBOARDING_STATUS,
    language_code: row.LANGUAGE_CODE,
    locale_code: row.LOCALE_CODE,
    primary_currency_code: row.PRIMARY_CURRENCY_CODE,
  };
}

export async function registerUser(payload) {
  const passwordHash = await bcrypt.hash(payload.password, 10);
  return withConnection(async (conn) => {
    const existing = await conn.execute(
      'SELECT id FROM users WHERE email = :email',
      { email: payload.email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    if (existing.rows?.length) {
      throw new Error('Email already exists');
    }

    const inserted = await conn.execute(
      `INSERT INTO users (
         id, email, password_hash, full_name, company_name, role, onboarding_status,
         language_code, locale_code, primary_currency_code
       )
       VALUES (
         SYS_GUID(), :email, :password_hash, :full_name, :company_name, :role, 'pending',
         :language_code, :locale_code, :primary_currency_code
       )
       RETURNING id INTO :id`,
      {
        email: payload.email,
        password_hash: passwordHash,
        full_name: payload.fullName,
        company_name: payload.companyName,
        role: payload.role || 'originator',
        language_code: payload.languageCode || null,
        locale_code: payload.localeCode || null,
        primary_currency_code: payload.primaryCurrencyCode || null,
        id: { dir: oracledb.BIND_OUT, type: oracledb.BUFFER },
      },
    );
    await conn.commit();
    const userId = inserted.outBinds.id[0];
    return {
      id: Buffer.isBuffer(userId) ? userId.toString('hex') : userId,
      email: payload.email,
      full_name: payload.fullName,
      company_name: payload.companyName,
      role: payload.role || 'originator',
      onboarding_status: 'pending',
      language_code: payload.languageCode || null,
      locale_code: payload.localeCode || null,
      primary_currency_code: payload.primaryCurrencyCode || null,
    };
  });
}

export async function loginUser(email, password) {
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `SELECT id, email, password_hash, role, full_name, company_name, onboarding_status,
              language_code, locale_code, primary_currency_code
       FROM users WHERE email = :email`,
      { email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const row = result.rows?.[0];
    if (!row) throw new Error('Invalid email or password');
    if (!row.PASSWORD_HASH || isOnboardingOnlyPasswordPlaceholder(row.PASSWORD_HASH)) {
      throw new Error('Use your secure onboarding link or set a password first');
    }
    const ok = await bcrypt.compare(password, row.PASSWORD_HASH);
    if (!ok) throw new Error('Invalid email or password');

    const user = normalizeRow(row);
    return { user, ...issueSessionTokens(user) };
  });
}

export async function getProfile(userId) {
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `SELECT id, email, role, full_name, company_name, onboarding_status,
              language_code, locale_code, primary_currency_code
       FROM users WHERE id = HEXTORAW(:id)`,
      { id: userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const row = result.rows?.[0];
    if (!row) return null;
    return normalizeRow(row);
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

export function rotateAccessToken(refreshToken) {
  const decoded = jwt.verify(refreshToken, env.jwt.refreshSecret);
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `SELECT id, email, role, full_name, company_name, onboarding_status,
              language_code, locale_code, primary_currency_code
       FROM users WHERE id = HEXTORAW(:id)`,
      { id: decoded.sub },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const row = result.rows?.[0];
    if (!row) throw new Error('User not found');
    const user = normalizeRow(row);
    return jwt.sign({ sub: user.id, email: user.email, role: user.role }, env.jwt.accessSecret, {
      expiresIn: env.jwt.accessTtl,
    });
  });
}

export function validatePassword(password) {
  if (!PASSWORD_POLICY.test(String(password || ''))) {
    throw new Error('Password must be at least 8 characters and include an uppercase letter and number');
  }
}
