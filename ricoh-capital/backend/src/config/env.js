import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

/** Normalize OCI "folder" prefix: "Ricoh" or "/Ricoh/" → "Ricoh/" */
function normalizeObjectPrefix(raw) {
  if (!raw || !String(raw).trim()) return '';
  const s = String(raw).trim().replace(/^\/+/g, '').replace(/\/+$/g, '');
  return s ? `${s}/` : '';
}

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  fx: {
    apiBaseUrl: process.env.FX_API_BASE_URL || 'https://api.frankfurter.dev/v1',
    apiKey: process.env.FX_API_KEY || '',
    baseCurrency: process.env.FX_BASE_CURRENCY || 'GBP',
    sourceName: process.env.FX_SOURCE_NAME || 'frankfurter',
  },
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
  email: {
    provider: process.env.EMAIL_PROVIDER || 'gmail',
    fromAddress: required('EMAIL_FROM_ADDRESS'),
    onboardingTtlHours: Number(process.env.ONBOARDING_TOKEN_TTL_HOURS || 48),
    gmail: {
      user: process.env.GMAIL_SMTP_USER || '',
      appPassword: process.env.GMAIL_APP_PASSWORD || '',
    },
    oci: {
      host: process.env.OCI_EMAIL_SMTP_HOST || '',
      port: Number(process.env.OCI_EMAIL_SMTP_PORT || 587),
      secure: String(process.env.OCI_EMAIL_SMTP_SECURE || 'false').toLowerCase() === 'true',
      user: process.env.OCI_EMAIL_SMTP_USER || '',
      password: process.env.OCI_EMAIL_SMTP_PASSWORD || '',
    },
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
    documentsPrefix: normalizeObjectPrefix(process.env.OCI_DOCUMENTS_PREFIX || ''),
    contractsPrefix: normalizeObjectPrefix(process.env.OCI_CONTRACTS_PREFIX || ''),
  },
};
