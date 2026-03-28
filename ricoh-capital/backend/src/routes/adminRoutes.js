import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { withConnection } from '../db/oracle.js';
import { approveDealTransaction, resendOnboardingInvite } from '../services/contractLifecycleService.js';

const router = Router();

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

router.post('/admin/send-invite', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const result = await withConnection(async (conn) => {
      const invite = await resendOnboardingInvite(conn, {
        dealId: req.body.dealId,
        adminId: req.user.id,
        customerEmail: req.body.customerEmail,
      });
      await conn.commit();
      return invite;
    });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/admin/reject-deal', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    if (!String(req.body.dealId || '').trim()) {
      return res.status(400).json({ error: 'dealId is required' });
    }
    if (!String(req.body.adminNotes || '').trim()) {
      return res.status(400).json({ error: 'Decision notes are required when rejecting a deal' });
    }

    await withConnection(async (conn) => {
      const result = await conn.execute(
        `UPDATE deals
         SET status = 'rejected',
             lifecycle_status = 'CLOSED',
             admin_notes = :admin_notes,
             reviewed_by = HEXTORAW(:reviewed_by),
             reviewed_at = SYSTIMESTAMP,
             updated_at = SYSTIMESTAMP
         WHERE id = HEXTORAW(:deal_id)
           AND lifecycle_status IN ('PENDING_APPROVAL', 'APPROVED')`,
        {
          admin_notes: req.body.adminNotes,
          reviewed_by: req.user.id,
          deal_id: req.body.dealId,
        },
      );
      if (!result.rowsAffected) throw new Error('Deal is not available for rejection');

      await conn.execute(
        `INSERT INTO audit_logs (id, entity_type, entity_id, action, performed_by, details, created_at)
         VALUES (SYS_GUID(), 'deal', HEXTORAW(:entity_id), 'deal_rejected', HEXTORAW(:performed_by), :details, SYSTIMESTAMP)`,
        {
          entity_id: req.body.dealId,
          performed_by: req.user.id,
          details: JSON.stringify({ notes: req.body.adminNotes }),
        },
      );
      await conn.commit();
    });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/admin/set-deal-under-review', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    if (!String(req.body.dealId || '').trim()) {
      return res.status(400).json({ error: 'dealId is required' });
    }

    await withConnection(async (conn) => {
      const result = await conn.execute(
        `UPDATE deals
         SET status = 'under_review',
             lifecycle_status = 'PENDING_APPROVAL',
             updated_at = SYSTIMESTAMP
         WHERE id = HEXTORAW(:deal_id)
           AND lifecycle_status = 'PENDING_APPROVAL'`,
        { deal_id: req.body.dealId },
      );
      if (!result.rowsAffected) throw new Error('Deal is not available for review');

      await conn.execute(
        `INSERT INTO audit_logs (id, entity_type, entity_id, action, performed_by, details, created_at)
         VALUES (SYS_GUID(), 'deal', HEXTORAW(:entity_id), 'deal_under_review', HEXTORAW(:performed_by), :details, SYSTIMESTAMP)`,
        {
          entity_id: req.body.dealId,
          performed_by: req.user.id,
          details: JSON.stringify({}),
        },
      );
      await conn.commit();
    });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/admin/invite-admin', requireAuth, requireRole('admin'), async (req, res) => {
  const { email, fullName } = req.body;
  return res.json({ ok: true, message: `Admin invite flow accepted for ${email}`, fullName });
});

router.post('/admin/update-payment-statuses', requireAuth, requireRole('admin'), async (_req, res) => {
  return res.json({ ok: true, updatedContracts: 0, updatedPayments: 0 });
});

export default router;
