import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  oracle: {
    user: required('ORACLE_USER'),
    password: required('ORACLE_PASSWORD'),
    connectString: required('ORACLE_CONNECT_STRING'),
    walletDir: process.env.ORACLE_WALLET_DIR,
  },
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL || '7d',
  },
  oci: {
    region: required('OCI_REGION'),
    tenancyId: required('OCI_TENANCY_ID'),
    userId: required('OCI_USER_ID'),
    fingerprint: required('OCI_FINGERPRINT'),
    privateKeyPath: required('OCI_PRIVATE_KEY_PATH'),
    passphrase: process.env.OCI_PASSPHRASE || '',
    namespace: required('OCI_NAMESPACE'),
    bucketDocuments: process.env.OCI_BUCKET_DOCUMENTS || 'documents',
    bucketContracts: process.env.OCI_BUCKET_CONTRACTS || 'contracts',
  },
};
