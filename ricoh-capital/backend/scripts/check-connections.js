/**
 * Standalone connectivity check for Oracle DB and OCI Object Storage.
 * Does not load full app config (no JWT_* required).
 *
 * Usage (from backend directory):
 *   node scripts/check-connections.js
 *   npm run check-connections
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import oracledb from 'oracledb';
import oci from 'oci-sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function fail(msg) {
  console.error(`  ✗ ${msg}`);
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Missing env var: ${name}`);
  }
  return v.trim();
}

function validateWalletDir(walletDir) {
  if (!fs.existsSync(walletDir)) {
    throw new Error(`ORACLE_WALLET_DIR does not exist: ${walletDir}`);
  }
  if (!fs.statSync(walletDir).isDirectory()) {
    throw new Error(`ORACLE_WALLET_DIR is not a directory: ${walletDir}`);
  }
  const need = ['tnsnames.ora', 'sqlnet.ora'];
  const missing = need.filter((f) => !fs.existsSync(path.join(walletDir, f)));
  if (missing.length) {
    throw new Error(
      `Wallet folder is missing ${missing.join(', ')} — unzip the ADB wallet so these files sit directly in ORACLE_WALLET_DIR`
    );
  }
  ok(`Wallet folder looks valid (${need.join(', ')} present)`);
}

async function checkOracle() {
  console.log('\nOracle database');
  const user = requireEnv('ORACLE_USER');
  const password = requireEnv('ORACLE_PASSWORD');
  const connectString = requireEnv('ORACLE_CONNECT_STRING');
  const walletDir = process.env.ORACLE_WALLET_DIR?.trim();

  if (walletDir) {
    try {
      validateWalletDir(walletDir);
    } catch (err) {
      fail(err.message || String(err));
      return false;
    }
    oracledb.configDir = walletDir;
    ok(`oracledb.configDir → ${walletDir}`);
  } else {
    ok('ORACLE_WALLET_DIR unset (use it for Autonomous DB wallet / mutual TLS)');
  }

  let connection;
  try {
    connection = await oracledb.getConnection({
      user,
      password,
      connectString,
    });
    const result = await connection.execute('SELECT 1 AS chk FROM dual');
    const row = result.rows?.[0];
    if (row?.[0] === 1) {
      ok('Connected; SELECT 1 FROM dual succeeded');
    } else {
      fail(`Unexpected query result: ${JSON.stringify(row)}`);
      return false;
    }
  } catch (err) {
    fail(err.message || String(err));
    return false;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch {
        /* ignore */
      }
    }
  }
  return true;
}

async function checkOci() {
  console.log('\nOCI Object Storage');
  const region = requireEnv('OCI_REGION');
  const tenancyId = requireEnv('OCI_TENANCY_ID');
  const userId = requireEnv('OCI_USER_ID');
  const fingerprint = requireEnv('OCI_FINGERPRINT');
  const privateKeyPath = requireEnv('OCI_PRIVATE_KEY_PATH');
  const namespace = requireEnv('OCI_NAMESPACE');
  const bucketDocuments =
    process.env.OCI_BUCKET_DOCUMENTS?.trim() || 'documents';
  const bucketContracts =
    process.env.OCI_BUCKET_CONTRACTS?.trim() || 'contracts';
  const passphrase = process.env.OCI_PASSPHRASE?.trim() || '';
  const ociRegion = oci.common.Region.fromRegionId(region);

  if (!ociRegion) {
    fail(`Unknown OCI region: ${region}`);
    return false;
  }

  let privateKey;
  try {
    privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    ok(`Private key readable: ${privateKeyPath}`);
  } catch (err) {
    fail(`Cannot read private key (${privateKeyPath}): ${err.message}`);
    return false;
  }

  let client;
  try {
    const provider = new oci.SimpleAuthenticationDetailsProvider(
      tenancyId,
      userId,
      fingerprint,
      privateKey,
      passphrase || null,
      ociRegion
    );
    client = new oci.objectstorage.ObjectStorageClient({
      authenticationDetailsProvider: provider,
    });
  } catch (err) {
    fail(`OCI provider / client: ${err.message || err}`);
    return false;
  }

  try {
    const res = await client.getBucket({
      namespaceName: namespace,
      bucketName: bucketDocuments,
    });
    const name = res.bucket?.name ?? bucketDocuments;
    const comp = res.bucket?.compartmentId;
    ok(
      `Bucket "${name}" reachable${
        comp ? ` (compartment ${comp.slice(0, 24)}…)` : ''
      }`
    );
  } catch (err) {
    const http = err.statusCode ? ` [HTTP ${err.statusCode}]` : '';
    const opc = err.opcRequestId ? ` opcRequestId=${err.opcRequestId}` : '';
    fail(`getBucket("${bucketDocuments}"): ${err.message || err}${http}${opc}`);
    return false;
  }

  if (bucketContracts !== bucketDocuments) {
    try {
      await client.getBucket({
        namespaceName: namespace,
        bucketName: bucketContracts,
      });
      ok(`Bucket "${bucketContracts}" reachable`);
    } catch (err) {
      const http = err.statusCode ? ` [HTTP ${err.statusCode}]` : '';
      fail(
        `getBucket("${bucketContracts}"): ${err.message || err}${http}`
      );
      return false;
    }
  } else {
    ok('OCI_BUCKET_CONTRACTS same as documents — skipped second getBucket');
  }

  return true;
}

async function main() {
  console.log('Backend connection check (Oracle + OCI)');
  console.log(`Env file: ${path.join(__dirname, '..', '.env')}`);

  let oracleOk = false;
  let ociOk = false;

  try {
    oracleOk = await checkOracle();
  } catch (err) {
    console.log('\nOracle database');
    fail(err.message || String(err));
  }

  try {
    ociOk = await checkOci();
  } catch (err) {
    console.log('\nOCI Object Storage');
    fail(err.message || String(err));
  }

  if (oracleOk && ociOk) {
    console.log('\nAll checks passed.\n');
    process.exit(0);
  }
  console.log('\nOne or more checks failed.\n');
  process.exit(1);
}

main();
