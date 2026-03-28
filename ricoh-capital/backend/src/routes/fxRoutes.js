import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { convertAmount, getFxRate } from '../services/fxService.js';

const router = Router();

router.use(requireAuth);

router.get('/rate', async (req, res) => {
  try {
    const data = await getFxRate(req.query.base, req.query.target);
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/convert', async (req, res) => {
  try {
    const data = await convertAmount(req.body.amount, req.body.baseCurrency, req.body.targetCurrency);
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

export default router;
