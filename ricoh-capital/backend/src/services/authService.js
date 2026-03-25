import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import oracledb from 'oracledb';
import { env } from '../config/env.js';
import { withConnection } from '../db/oracle.js';

function signTokens(user) {
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
      `INSERT INTO users (id, email, password_hash, full_name, company_name, role, onboarding_status)
       VALUES (SYS_GUID(), :email, :password_hash, :full_name, :company_name, :role, 'pending')
       RETURNING id INTO :id`,
      {
        email: payload.email,
        password_hash: passwordHash,
        full_name: payload.fullName,
        company_name: payload.companyName,
        role: payload.role || 'originator',
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
    };
  });
}

export async function loginUser(email, password) {
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `SELECT id, email, password_hash, role, full_name, company_name, onboarding_status
       FROM users WHERE email = :email`,
      { email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const row = result.rows?.[0];
    if (!row) throw new Error('Invalid email or password');
    const ok = await bcrypt.compare(password, row.PASSWORD_HASH);
    if (!ok) throw new Error('Invalid email or password');

    const user = normalizeRow(row);
    return { user, ...signTokens(user) };
  });
}

export async function getProfile(userId) {
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `SELECT id, email, role, full_name, company_name, onboarding_status
       FROM users WHERE id = :id`,
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
  return jwt.sign({ sub: decoded.sub }, env.jwt.accessSecret, { expiresIn: env.jwt.accessTtl });
}
