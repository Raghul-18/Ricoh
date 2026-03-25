import fs from 'node:fs';
import crypto from 'node:crypto';
import oci from 'oci-sdk';
import { env } from '../config/env.js';

const provider = new oci.Common.SimpleAuthenticationDetailsProvider(
  env.oci.tenancyId,
  env.oci.userId,
  env.oci.fingerprint,
  fs.readFileSync(env.oci.privateKeyPath, 'utf8'),
  null,
  env.oci.region,
  env.oci.passphrase || null,
);

const objectStorageClient = new oci.ObjectStorage.ObjectStorageClient({
  authenticationDetailsProvider: provider,
});

function makeDocumentObjectName(userId, documentType, fileName) {
  const ext = fileName.includes('.') ? fileName.split('.').pop() : 'bin';
  const prefix = env.oci.documentsPrefix;
  return `${prefix}${userId}/${documentType}_${Date.now()}.${ext}`;
}

export async function uploadDocumentObject({
  userId,
  documentType,
  fileName,
  contentType,
  stream,
  bucketName = env.oci.bucketDocuments,
}) {
  const objectName = makeDocumentObjectName(userId, documentType, fileName);
  await objectStorageClient.putObject({
    namespaceName: env.oci.namespace,
    bucketName,
    objectName,
    putObjectBody: stream,
    contentType,
  });
  return { path: objectName };
}

export async function createSignedReadUrl({
  objectName,
  bucketName = env.oci.bucketDocuments,
  expiresInSeconds = 3600,
}) {
  // This keeps backend adapter simple and works with private buckets by pathing through backend.
  // For production hardening, replace with OCI PAR generation and strict policy controls.
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  const token = crypto
    .createHmac('sha256', env.jwt.accessSecret)
    .update(`${bucketName}:${objectName}:${expiresAt}`)
    .digest('hex');
  return `/api/files/read?bucket=${encodeURIComponent(bucketName)}&path=${encodeURIComponent(objectName)}&exp=${expiresAt}&sig=${token}`;
}

export function verifySignedReadUrl({ bucketName, objectName, exp, sig }) {
  if (!bucketName || !objectName || !exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = crypto
    .createHmac('sha256', env.jwt.accessSecret)
    .update(`${bucketName}:${objectName}:${exp}`)
    .digest('hex');
  return expected === sig;
}

export async function getObjectStream({ bucketName, objectName }) {
  const response = await objectStorageClient.getObject({
    namespaceName: env.oci.namespace,
    bucketName,
    objectName,
  });
  return response.value;
}
