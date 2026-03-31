import { Router } from 'express';
import oracledb from 'oracledb';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { withConnection } from '../db/oracle.js';
import {
  createClosureRequest,
  queueContractSigningEmails,
  recordContractViewed,
  reviewClosureRequest,
  signContract,
  terminateContractDirect,
} from '../services/contractLifecycleService.js';

const router = Router();

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [key.toLowerCase(), Buffer.isBuffer(value) ? value.toString('hex') : value]),
  );
}

async function getContractForUser(conn, contractId, user) {
  const result = await conn.execute(
    `SELECT id, customer_id, originator_id
     FROM contracts
     WHERE id = HEXTORAW(:contract_id)`,
    { contract_id: contractId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const contract = result.rows?.[0] ? normalizeRow(result.rows[0]) : null;
  if (!contract) return null;
  if (user.role === 'admin') return contract;
  if (user.role === 'customer' && contract.customer_id === user.id) return contract;
  if (user.role === 'originator' && contract.originator_id === user.id) return contract;
  return null;
}

router.post('/contracts/:contractId/view', requireAuth, async (req, res) => {
  try {
    const contract = await withConnection((conn) => getContractForUser(conn, req.params.contractId, req.user));
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    await withConnection(async (conn) => {
      await recordContractViewed(conn, {
        contractId: req.params.contractId,
        actorId: req.user.id,
        role: req.user.role,
      });
      await conn.commit();
    });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/contracts/:contractId/sign', requireAuth, async (req, res) => {
  try {
    if (!['admin', 'customer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!String(req.body.signerName || '').trim() || !String(req.body.signaturePayload || '').trim()) {
      return res.status(400).json({ error: 'Signer name and signature are required' });
    }

    const result = await withConnection(async (conn) => {
      const contract = await getContractForUser(conn, req.params.contractId, req.user);
      if (!contract) throw new Error('Contract not found');
      const signed = await signContract(conn, {
        contractId: req.params.contractId,
        signerRole: req.user.role === 'admin' ? 'admin' : 'customer',
        signerUserId: req.user.id,
        signerName: req.body.signerName,
        signaturePayload: req.body.signaturePayload,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || '',
      });
      await conn.commit();
      return signed;
    });
    const { postCommitEmailJob, ...response } = result;
    if (postCommitEmailJob?.type === 'contract-signing') {
      queueContractSigningEmails(postCommitEmailJob);
    }

    return res.json(response);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/contracts/:contractId/closure-requests', requireAuth, requireRole('customer', 'admin'), async (req, res) => {
  try {
    const result = await withConnection(async (conn) => {
      const contract = await getContractForUser(conn, req.params.contractId, req.user);
      if (!contract) throw new Error('Contract not found');
      const requestId = await createClosureRequest(conn, {
        contractId: req.params.contractId,
        requestedBy: req.user.id,
        requestedRole: req.user.role,
        requestedDate: req.body.requestedDate,
        effectiveEndDate: req.body.effectiveEndDate,
        reason: req.body.reason,
        settlementAmount: req.body.settlementAmount,
        notes: req.body.notes,
        lifecycleTarget: req.body.lifecycleTarget,
      });
      await conn.commit();
      return { requestId };
    });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/contracts/:contractId/terminate', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const result = await withConnection(async (conn) => {
      const requestId = await terminateContractDirect(conn, {
        contractId: req.params.contractId,
        adminId: req.user.id,
        effectiveEndDate: req.body.effectiveEndDate,
        reason: req.body.reason,
        settlementAmount: req.body.settlementAmount,
        notes: req.body.notes,
      });
      await conn.commit();
      return { requestId };
    });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/closure-requests/:requestId/review', requireAuth, requireRole('admin'), async (req, res) => {
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
