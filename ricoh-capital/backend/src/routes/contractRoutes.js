import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { withConnection } from '../db/oracle.js';
import {
  createClosureRequest,
  reviewClosureRequest,
  signContract,
  terminateContractDirect,
} from '../services/contractLifecycleService.js';

const router = Router();

router.post('/contracts/:contractId/sign', requireAuth, async (req, res) => {
  const { contractId } = req.params;
  const signerRole = req.user.role === 'admin' ? 'admin' : req.user.role === 'customer' ? 'customer' : null;
  if (!signerRole) return res.status(403).json({ error: 'Forbidden' });

  try {
    const result = await withConnection(async (conn) => {
      const signed = await signContract(conn, {
        contractId,
        signerRole,
        signerUserId: req.user.id,
        signerName: req.body.signerName,
        signaturePayload: req.body.signaturePayload,
      });
      await conn.commit();
      return signed;
    });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/contracts/:contractId/closure-requests', requireAuth, async (req, res) => {
  if (!['customer', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const requestId = await withConnection(async (conn) => {
      const id = await createClosureRequest(conn, {
        contractId: req.params.contractId,
        requestedBy: req.user.id,
        requestedRole: req.user.role === 'admin' ? 'admin' : 'customer',
        requestedDate: req.body.requestedDate,
        effectiveEndDate: req.body.effectiveEndDate,
        reason: req.body.reason,
        settlementAmount: req.body.settlementAmount,
        notes: req.body.notes,
      });
      await conn.commit();
      return id;
    });
    return res.json({ requestId });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/contracts/:contractId/terminate', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const requestId = await withConnection(async (conn) => {
      const id = await terminateContractDirect(conn, {
        contractId: req.params.contractId,
        adminId: req.user.id,
        effectiveEndDate: req.body.effectiveEndDate,
        reason: req.body.reason,
        settlementAmount: req.body.settlementAmount,
        notes: req.body.notes,
      });
      await conn.commit();
      return id;
    });
    return res.json({ requestId, status: 'approved' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/closure-requests/:requestId/review', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const result = await withConnection(async (conn) => {
      const reviewed = await reviewClosureRequest(conn, {
        requestId: req.params.requestId,
        reviewerId: req.user.id,
        status: req.body.status,
        reviewNotes: req.body.reviewNotes,
        settlementAmount: req.body.settlementAmount,
        effectiveEndDate: req.body.effectiveEndDate,
      });
      await conn.commit();
      return reviewed;
    });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

export default router;
