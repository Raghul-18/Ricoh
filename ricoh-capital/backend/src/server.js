import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { closeOraclePool, initOraclePool } from './db/oracle.js';
import authRoutes from './routes/authRoutes.js';
import queryRoutes from './routes/queryRoutes.js';
import storageRoutes from './routes/storageRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import fxRoutes from './routes/fxRoutes.js';
import contractRoutes from './routes/contractRoutes.js';

const app = express();

app.use(
  cors({
    origin: env.frontendOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: '15mb' }));
app.use(cookieParser());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api', queryRoutes);
app.use('/api', storageRoutes);
app.use('/api', adminRoutes);
app.use('/api', contractRoutes);
app.use('/api/fx', fxRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await initOraclePool();
  app.listen(env.port, () => {
    console.log(`Backend running on http://localhost:${env.port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start backend', error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  await closeOraclePool();
  process.exit(0);
});
