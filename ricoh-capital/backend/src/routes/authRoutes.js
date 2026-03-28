import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getProfile, issueSessionTokens, loginUser, registerUser, rotateAccessToken, validatePassword } from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';
import { withConnection } from '../db/oracle.js';
import { consumeOnboardingToken } from '../services/contractLifecycleService.js';

const router = Router();

router.post('/signup', async (req, res) => {
  try {
    const user = await registerUser(req.body);
    const login = await loginUser(req.body.email, req.body.password);
    return res.json({ user, session: { access_token: login.accessToken, refresh_token: login.refreshToken } });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);
    return res.json({
      user: result.user,
      session: { access_token: result.accessToken, refresh_token: result.refreshToken },
    });
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const token = req.body.refresh_token;
    const accessToken = await rotateAccessToken(token);
    return res.json({ access_token: accessToken });
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.get('/session', requireAuth, async (req, res) => {
  const profile = await getProfile(req.user.id);
  return res.json({ user: profile, session: { access_token: (req.headers.authorization || '').replace(/^Bearer\s+/i, '') } });
});

router.get('/me', requireAuth, async (req, res) => {
  const profile = await getProfile(req.user.id);
  return res.json(profile);
});

router.post('/reset-password-request', async (_req, res) => {
  // Wire email provider here in production.
  return res.json({ ok: true });
});

router.post('/onboard/consume', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Onboarding token is required' });

    const result = await withConnection(async (conn) => {
      const consumed = await consumeOnboardingToken(conn, {
        token,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || '',
      });
      const tokens = issueSessionTokens(consumed.user);
      await conn.commit();
      return {
        user: consumed.user,
        session: { access_token: tokens.accessToken, refresh_token: tokens.refreshToken },
        redirect_path: consumed.redirectPath,
        contract_id: consumed.contractId,
      };
    });

    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/update-password', requireAuth, async (req, res) => {
  const { password } = req.body;
  validatePassword(password);
  const hash = await bcrypt.hash(password, 10);
  await withConnection(async (conn) => {
    await conn.execute('UPDATE users SET password_hash = :h WHERE id = HEXTORAW(:id)', {
      h: hash,
      id: req.user.id,
    });
    await conn.commit();
  });
  return res.json({ ok: true });
});

export default router;
