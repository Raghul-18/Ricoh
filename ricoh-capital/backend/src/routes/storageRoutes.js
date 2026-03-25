import { Readable } from 'stream';
import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import {
  createSignedReadUrl,
  getObjectStream,
  uploadDocumentObject,
  verifySignedReadUrl,
} from '../services/objectStorageService.js';

const router = Router();
const upload = multer();

function inferContentType(objectName) {
  const lower = String(objectName || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

router.post('/files/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const { documentType } = req.body;
    const result = await uploadDocumentObject({
      userId: req.user.id,
      documentType,
      fileName: req.file.originalname,
      contentType: req.file.mimetype,
      stream: req.file.buffer,
    });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.get('/files/signed-url', requireAuth, async (req, res) => {
  try {
    const { path, expiresIn } = req.query;
    const signedPath = await createSignedReadUrl({
      objectName: path,
      expiresInSeconds: Number(expiresIn || 3600),
    });
    return res.json({ signedUrl: signedPath });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.get('/files/read', async (req, res) => {
  const bucketName = String(req.query.bucket || '');
  const objectName = String(req.query.path || '');
  const exp = String(req.query.exp || '');
  const sig = String(req.query.sig || '');

  if (!verifySignedReadUrl({ bucketName, objectName, exp, sig })) {
    return res.status(403).json({ error: 'Invalid or expired URL' });
  }

  try {
    console.log('READ FILE', { bucketName, objectName });
    const { stream, contentType, contentLength, etag } = await getObjectStream({ bucketName, objectName });
    const resolvedContentType = contentType || inferContentType(objectName);

    res.setHeader('Content-Type', resolvedContentType);
    res.setHeader('Content-Disposition', 'inline');
    if (contentLength) res.setHeader('Content-Length', String(contentLength));
    if (etag) res.setHeader('ETag', etag);

    // Case 1: Node.js Readable stream
    if (stream && typeof stream.pipe === 'function') {
      stream.pipe(res);
      return undefined;
    }

    // Case 2: Web Streams API ReadableStream (what OCI SDK returns in Node 22)
    if (stream && typeof stream.getReader === 'function') {
      const nodeStream = Readable.fromWeb(stream);
      nodeStream.pipe(res);
      return undefined;
    }

    // Case 3: Buffer or Uint8Array
    if (stream instanceof Uint8Array || Buffer.isBuffer(stream)) {
      res.end(Buffer.from(stream));
      return undefined;
    }

    // Case 4: Raw string
    if (typeof stream === 'string') {
      res.end(stream);
      return undefined;
    }

    console.error('READ FILE UNSUPPORTED TYPE', {
      bucketName,
      objectName,
      typeOfStream: typeof stream,
      constructorName: stream?.constructor?.name,
      hasArrayBuffer: typeof stream?.arrayBuffer,
      hasGetReader: typeof stream?.getReader,
      hasPipeTo: typeof stream?.pipeTo,
      keys: stream && typeof stream === 'object' ? Object.keys(stream).slice(0, 10) : [],
    });

    throw new Error('Unsupported object response type');
  } catch (error) {
    console.error('READ FILE ERROR', {
      bucketName,
      objectName,
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
    });
    return res.status(404).json({ error: error.message });
  }
});

export default router;