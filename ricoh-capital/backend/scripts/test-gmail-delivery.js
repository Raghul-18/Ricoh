/**
 * Gmail-specific SMTP connectivity and delivery test.
 *
 * Usage (from backend directory):
 *   node scripts/test-gmail-delivery.js --to someone@example.com
 *   npm run test-gmail -- --to someone@example.com
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function parseArgs(argv) {
  const args = { to: '' };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--to' && argv[index + 1]) {
      args.to = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const user = required('GMAIL_SMTP_USER');
  const pass = required('GMAIL_APP_PASSWORD');
  const from = process.env.EMAIL_FROM_ADDRESS || user;
  const to = args.to || from;

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    connectionTimeout: Number(process.env.EMAIL_CONNECTION_TIMEOUT_MS || 4000),
    greetingTimeout: Number(process.env.EMAIL_GREETING_TIMEOUT_MS || 4000),
    socketTimeout: Number(process.env.EMAIL_SOCKET_TIMEOUT_MS || 5000),
    auth: { user, pass },
  });

  console.log('[test-gmail] starting', {
    host: 'smtp.gmail.com',
    port: 587,
    user,
    from,
    to,
  });

  try {
    const verifyStartedAt = Date.now();
    await transporter.verify();
    console.log('[test-gmail] verify success', {
      durationMs: Date.now() - verifyStartedAt,
    });
  } catch (error) {
    console.error('[test-gmail] verify failed', {
      message: error.message,
      code: error.code || null,
      command: error.command || null,
      response: error.response || null,
    });
    process.exit(1);
  }

  try {
    const sendStartedAt = Date.now();
    const info = await transporter.sendMail({
      from,
      to,
      subject: 'Ricoh Capital Gmail delivery test',
      text: `Gmail delivery test succeeded at ${new Date().toISOString()}`,
      html: `<p>Gmail delivery test succeeded at ${new Date().toISOString()}</p>`,
    });

    console.log('[test-gmail] send success', {
      durationMs: Date.now() - sendStartedAt,
      accepted: info.accepted || [],
      rejected: info.rejected || [],
      pending: info.pending || [],
      response: info.response || '',
      messageId: info.messageId || '',
    });
    process.exit(0);
  } catch (error) {
    console.error('[test-gmail] send failed', {
      message: error.message,
      code: error.code || null,
      command: error.command || null,
      response: error.response || null,
    });
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[test-gmail] fatal', {
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
