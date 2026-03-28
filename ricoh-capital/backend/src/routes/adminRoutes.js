import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { withConnection } from '../db/oracle.js';
import { approveDealTransaction } from '../services/contractLifecycleService.js';

const router = Router();

router.post('/admin/invite-customer', requireAuth, requireRole('admin'), async (req, res) => {
  const { email, customerName, contractId, dealId } = req.body;
  await withConnection((conn) =>
    conn.execute(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, performed_by, details)
       VALUES (SYS_GUID(), 'customer_invite', :dealId, 'invite_sent', :adminId, :details)`,
      {
        dealId,
        adminId: req.user.id,
        details: JSON.stringify({ email, customerName, contractId }),
      },
    ),
  );
  return res.json({ ok: true, message: `Invite flow accepted for ${email}` });
});

router.post('/admin/approve-deal', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const result = await withConnection(async (conn) => {
      const approved = await approveDealTransaction(conn, {
        dealId: req.body.dealId,
        adminId: req.user.id,
        adminNotes: req.body.adminNotes,
        startDate: req.body.startDate,
        customerEmail: req.body.customerEmail,
      });
      await conn.commit();
      return approved;
    });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/admin/invite-admin', requireAuth, requireRole('admin'), async (req, res) => {
  const { email, fullName } = req.body;
  return res.json({ ok: true, message: `Admin invite flow accepted for ${email}`, fullName });
});

router.post('/admin/update-payment-statuses', requireAuth, requireRole('admin'), async (_req, res) => {
  // This endpoint is intended for cron/worker invocation.
  return res.json({ ok: true, updatedContracts: 0, updatedPayments: 0 });
});

export default router;
