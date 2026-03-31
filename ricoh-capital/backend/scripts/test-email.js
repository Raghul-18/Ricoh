/**
 * Standalone email-delivery check using the app's configured provider.
 *
 * Usage (from backend directory):
 *   node scripts/test-email.js
 *   node scripts/test-email.js --to someone@example.com
 *   node scripts/test-email.js --to someone@example.com --type onboarding
 *   npm run test-email -- --to someone@example.com --type signed
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { env } from '../src/config/env.js';
import { getEmailService } from '../src/email/service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function parseArgs(argv) {
  const args = { to: '', type: 'deal-approved' };
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--to' && argv[index + 1]) {
      args.to = argv[index + 1];
      index += 1;
      continue;
    }
    if (current === '--type' && argv[index + 1]) {
      args.type = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function resolveRecipient(explicitTo) {
  return explicitTo || env.email.fromAddress || env.email.gmail.user;
}

async function sendTestEmail(service, { to, type }) {
  const base = {
    to,
    variables: {
      customerName: 'Test Customer',
      contractReference: 'CON-TEST-001',
      dealReference: 'DEAL-TEST-001',
      lifecycleStatus: 'AWAITING_CUSTOMER_SIGNATURE',
      onboardingUrl: `${env.frontendOrigin.replace(/\/+$/, '')}/onboard?token=test-token`,
      expiresAtLabel: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      signerRole: 'customer',
    },
  };

  switch (type) {
    case 'onboarding':
      return service.sendOnboardingInvite(base);
    case 'signed':
      return service.sendContractSigned(base);
    case 'executed':
      return service.sendFullyExecuted(base);
    case 'deal-approved':
    default:
      return service.sendDealApproved(base);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const to = resolveRecipient(args.to);
  const type = args.type;

  console.log('[test-email] starting', {
    provider: env.email.provider,
    to,
    type,
    from: env.email.fromAddress,
  });

  try {
    const service = getEmailService();
    const result = await sendTestEmail(service, { to, type });
    console.log('[test-email] success', result || { ok: true });
    process.exit(0);
  } catch (error) {
    console.error('[test-email] failed', {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

main();
