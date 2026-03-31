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
    poolMin: env.oracle.poolMin,
    poolMax: env.oracle.poolMax,
    poolIncrement: env.oracle.poolIncrement,
    queueTimeout: env.oracle.queueTimeoutMs,
  };
  if (env.oracle.walletDir) {
    poolConfig.configDir = env.oracle.walletDir;
  }
  pool = await oracledb.createPool(poolConfig);
  return pool;
}

export async function withConnection(fn) {
  const acquireStartedAt = Date.now();
  const conn = await oracledb.getConnection();
  const acquireDurationMs = Date.now() - acquireStartedAt;
  if (acquireDurationMs >= 250) {
    console.warn('[Oracle] slow connection acquire', {
      durationMs: acquireDurationMs,
      poolOpenConnections: pool?.connectionsOpen,
      poolInUseConnections: pool?.connectionsInUse,
    });
  }

  const startedAt = Date.now();
  try {
    return await fn(conn);
  } finally {
    const durationMs = Date.now() - startedAt;
    if (durationMs >= 800) {
      console.warn('[Oracle] slow connection usage', {
        durationMs,
        poolOpenConnections: pool?.connectionsOpen,
        poolInUseConnections: pool?.connectionsInUse,
      });
    }
    await conn.close();
  }
}

export async function closeOraclePool() {
  if (pool) {
    await pool.close(10);
    pool = null;
  }
}
