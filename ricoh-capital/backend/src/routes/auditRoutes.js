import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { withConnection } from '../db/oracle.js';

const router = Router();

router.post('/audit/log', requireAuth, async (req, res) => {
  try {
    const { entityType, entityId, action, details } = req.body;
    if (!entityType || !action) {
      return res.status(400).json({ error: 'entityType and action are required' });
    }

    await withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO audit_logs (id, entity_type, entity_id, action, performed_by, details, created_at)
         VALUES (
           SYS_GUID(),
           :entity_type,
           ${entityId ? 'HEXTORAW(:entity_id)' : 'NULL'},
           :action,
           HEXTORAW(:performed_by),
           :details,
           SYSTIMESTAMP
         )`,
        {
          entity_type: entityType,
          entity_id: entityId || null,
          action,
          performed_by: req.user.id,
          details: JSON.stringify(details || {}),
        },
      );
      await conn.commit();
    });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

export default router;
