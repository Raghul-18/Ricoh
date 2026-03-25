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
    const stream = await getObjectStream({ bucketName, objectName });
    stream.pipe(res);
    return undefined;
  } catch (error) {
    return res.status(404).json({ error: error.message });
  }
});

export default router;
