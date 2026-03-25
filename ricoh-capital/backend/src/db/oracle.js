import oracledb from 'oracledb';
import { env } from '../config/env.js';

let pool;

export async function initOraclePool() {
  if (pool) return pool;
  if (env.oracle.walletDir) {
    oracledb.configDir = env.oracle.walletDir;
  }
  pool = await oracledb.createPool({
    user: env.oracle.user,
    password: env.oracle.password,
    connectString: env.oracle.connectString,
    poolMin: 1,
    poolMax: 10,
    poolIncrement: 1,
  });
  return pool;
}

export async function withConnection(fn) {
  const conn = await oracledb.getConnection();
  try {
    return await fn(conn);
  } finally {
    await conn.close();
  }
}

export async function closeOraclePool() {
  if (pool) {
    await pool.close(10);
    pool = null;
  }
}
