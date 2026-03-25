import oracledb from 'oracledb';
import { env } from '../config/env.js';

let pool;

// Return CLOB columns as strings so API responses stay serializable and
// frontend components don't receive Oracle LOB objects.
oracledb.fetchAsString = [oracledb.CLOB];

export async function initOraclePool() {
  if (pool) return pool;
  const poolConfig = {
    user: env.oracle.user,
    password: env.oracle.password,
    connectString: env.oracle.connectString,
    poolMin: 1,
    poolMax: 10,
    poolIncrement: 1,
  };
  if (env.oracle.walletDir) {
    poolConfig.configDir = env.oracle.walletDir;
  }
  pool = await oracledb.createPool(poolConfig);
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
