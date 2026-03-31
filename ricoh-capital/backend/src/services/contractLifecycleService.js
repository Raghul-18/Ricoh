import crypto from 'node:crypto';
import oracledb from 'oracledb';
import { env } from '../config/env.js';
import { withConnection } from '../db/oracle.js';
import { getEmailService } from '../email/service.js';
import { makeOnboardingOnlyPasswordPlaceholder } from './onboardingPassword.js';

const DEAL_LIFECYCLE = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  CUSTOMER_SIGNED: 'CUSTOMER_SIGNED',
  ACTIVE: 'ACTIVE',
  TERMINATION_REQUESTED: 'TERMINATION_REQUESTED',
  TERMINATED: 'TERMINATED',
  CLOSED: 'CLOSED',
};

const CONTRACT_LIFECYCLE = {
  AWAITING_CUSTOMER_SIGNATURE: 'AWAITING_CUSTOMER_SIGNATURE',
  CUSTOMER_SIGNED: 'CUSTOMER_SIGNED',
  AWAITING_ADMIN_SIGNATURE: 'AWAITING_ADMIN_SIGNATURE',
  FULLY_SIGNED: 'FULLY_SIGNED',
  ACTIVE: 'ACTIVE',
  TERMINATION_REQUESTED: 'TERMINATION_REQUESTED',
  TERMINATED: 'TERMINATED',
  CLOSED: 'CLOSED',
};

function normalizeRecord(row) {
  return Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [key.toLowerCase(), Buffer.isBuffer(value) ? value.toString('hex') : value]),
  );
}

function buildContractSnapshot(deal, overrides = {}) {
  return {
    customerName: overrides.customerName || deal.customer_name,
    customerEmail: overrides.customerEmail || deal.customer_email || deal.temp_customer_email || null,
    productType: deal.product_type,
    productFamily: deal.product_family,
    payload: deal.deal_payload || null,
    finance: {
      assetValue: Number(deal.asset_value || 0),
      monthlyPayment: Number(deal.monthly_payment || 0),
      termMonths: Number(deal.term_months || 0),
      apr: Number(deal.proposed_apr || deal.apr || 0),
      balloon: Number(deal.balloon || 0),
      deposit: Number(deal.deposit || 0),
    },
  };
}

function hashSnapshot(snapshot) {
  return crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

function makeReference(prefix) {
  return `${prefix}-${new Date().getUTCFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function makeOnboardingToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return {
    plain: token,
    hash: crypto.createHash('sha256').update(token).digest('hex'),
  };
}

async function getUserByEmail(conn, email) {
  const result = await conn.execute(
    `SELECT id, email, role, full_name, onboarding_status, must_reset
     FROM users
     WHERE LOWER(email) = LOWER(:email)`,
    { email },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return result.rows?.[0] ? normalizeRecord(result.rows[0]) : null;
}

async function ensureCustomerUser(conn, { email, customerName }) {
  const existing = await getUserByEmail(conn, email);
  if (existing) {
    await conn.execute(
      `UPDATE users
       SET role = 'customer',
           full_name = COALESCE(full_name, :full_name),
           onboarding_status = 'approved',
           updated_at = SYSTIMESTAMP
       WHERE id = HEXTORAW(:id)`,
      { full_name: customerName || null, id: existing.id },
    );
    return { userId: existing.id, email: existing.email, isExisting: true };
  }

  const inserted = await conn.execute(
    `INSERT INTO users (
       id, email, password_hash, full_name, role, onboarding_status, must_reset, created_at, updated_at
     ) VALUES (
       SYS_GUID(), :email, :password_hash, :full_name, 'customer', 'approved', 0, SYSTIMESTAMP, SYSTIMESTAMP
     )
     RETURNING id INTO :out_id`,
    {
      email,
      password_hash: makeOnboardingOnlyPasswordPlaceholder(),
      full_name: customerName || null,
      out_id: { dir: oracledb.BIND_OUT, type: oracledb.BUFFER },
    },
  );

  return {
    userId: inserted.outBinds.out_id[0].toString('hex'),
    email,
    isExisting: false,
  };
}

async function insertAuditLog(conn, { actorId, action, entityType, entityId, metadata }) {
  await conn.execute(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, performed_by, details, created_at)
     VALUES (
       SYS_GUID(),
       :entity_type,
       ${entityId ? 'HEXTORAW(:entity_id)' : 'NULL'},
       :action,
       ${actorId ? 'HEXTORAW(:actor_id)' : 'NULL'},
       :details,
       SYSTIMESTAMP
     )`,
    {
      actor_id: actorId || null,
      entity_type: entityType,
      entity_id: entityId || null,
      action,
      details: JSON.stringify(metadata || {}),
    },
  );
}

function queueBackgroundTask(label, task) {
  setTimeout(() => {
    void (async () => {
      try {
        await task();
      } catch (error) {
        console.error('[BackgroundTask] failed', {
          label,
          error: error.message,
        });
      }
    })();
  }, 0);
}

async function writeAuditLogAfterCommit(payload) {
  await withConnection(async (conn) => {
    await insertAuditLog(conn, payload);
    await conn.commit();
  });
}

function deriveContractLifecycle({ customerSigned, adminSigned }) {
  if (customerSigned && adminSigned) return CONTRACT_LIFECYCLE.ACTIVE;
  if (customerSigned) return CONTRACT_LIFECYCLE.AWAITING_ADMIN_SIGNATURE;
  return CONTRACT_LIFECYCLE.AWAITING_CUSTOMER_SIGNATURE;
}

function deriveDealLifecycle({ customerSigned, adminSigned }) {
  if (customerSigned && adminSigned) return DEAL_LIFECYCLE.ACTIVE;
  if (customerSigned) return DEAL_LIFECYCLE.CUSTOMER_SIGNED;
  return DEAL_LIFECYCLE.APPROVED;
}

async function loadExistingContract(conn, dealId) {
  const result = await conn.execute(
    `SELECT id, reference_number, lifecycle_status, customer_id, version
     FROM contracts
     WHERE deal_id = HEXTORAW(:deal_id)`,
    { deal_id: dealId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return result.rows?.[0] ? normalizeRecord(result.rows[0]) : null;
}

async function countSignatures(conn, contractId) {
  const result = await conn.execute(
    `SELECT role
     FROM signatures
     WHERE contract_id = HEXTORAW(:contract_id)
       AND invalidated_at IS NULL`,
    { contract_id: contractId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const roles = new Set((result.rows || []).map((row) => row.ROLE));
  return {
    customerSigned: roles.has('customer'),
    adminSigned: roles.has('admin'),
  };
}

async function createOnboardingToken(conn, { userId, contractId, adminId }) {
  await conn.execute(
    `UPDATE onboarding_tokens
     SET invalidated_at = SYSTIMESTAMP
     WHERE user_id = HEXTORAW(:user_id)
       AND contract_id = HEXTORAW(:contract_id)
       AND used_at IS NULL
       AND invalidated_at IS NULL`,
    { user_id: userId, contract_id: contractId },
  );

  const token = makeOnboardingToken();
  const expiresAt = new Date(Date.now() + env.email.onboardingTtlHours * 60 * 60 * 1000);
  await conn.execute(
    `INSERT INTO onboarding_tokens (
       id, user_id, contract_id, token_hash, expires_at, created_by, delivery_channel, created_at
     ) VALUES (
       SYS_GUID(), HEXTORAW(:user_id), HEXTORAW(:contract_id), :token_hash, :expires_at, HEXTORAW(:created_by), 'email', SYSTIMESTAMP
     )`,
    {
      user_id: userId,
      contract_id: contractId,
      token_hash: token.hash,
      expires_at: expiresAt,
      created_by: adminId,
    },
  );

  console.log('[OnboardingToken] created', {
    userId,
    contractId,
    createdBy: adminId,
    tokenLength: token.plain.length,
    tokenPreview: token.plain.slice(0, 8),
    tokenHashPreview: token.hash.slice(0, 12),
    expiresAt: expiresAt.toISOString(),
  });

  return { plainToken: token.plain, expiresAt };
}

async function sendOnboardingInviteEmail({ customerEmail, customerName, contractReference, onboardingUrl, expiresAt }) {
  const emailService = getEmailService();
  await emailService.sendOnboardingInvite({
    to: customerEmail,
    variables: {
      customerName,
      contractReference,
      onboardingUrl,
      expiresAtLabel: expiresAt.toISOString(),
    },
  });
}

export function queueApproveDealEmails({
  adminId,
  dealId,
  contractId,
  customerEmail,
  customerName,
  contractReference,
  dealReference,
  onboardingUrl,
  expiresAt,
}) {
  queueBackgroundTask('approve-deal-emails', async () => {
    const emailService = getEmailService();
    const [onboardingEmailResult, approvalEmailResult] = await Promise.allSettled([
      sendOnboardingInviteEmail({
        customerEmail,
        customerName,
        contractReference,
        onboardingUrl,
        expiresAt: new Date(expiresAt),
      }),
      emailService.sendDealApproved({
        to: customerEmail,
        variables: {
          customerName,
          contractReference,
          lifecycleStatus: CONTRACT_LIFECYCLE.AWAITING_CUSTOMER_SIGNATURE,
          dealReference,
        },
      }),
    ]);

    if (onboardingEmailResult.status === 'fulfilled') {
      await writeAuditLogAfterCommit({
        actorId: adminId,
        entityType: 'contract',
        entityId: contractId,
        action: 'onboarding_sent',
        metadata: { customerEmail, expiresAt },
      });
    } else {
      await writeAuditLogAfterCommit({
        actorId: adminId,
        entityType: 'contract',
        entityId: contractId,
        action: 'onboarding_send_failed',
        metadata: {
          customerEmail,
          expiresAt,
          error: onboardingEmailResult.reason?.message || String(onboardingEmailResult.reason),
        },
      });
    }

    if (approvalEmailResult.status === 'rejected') {
      await writeAuditLogAfterCommit({
        actorId: adminId,
        entityType: 'deal',
        entityId: dealId,
        action: 'deal_approval_email_failed',
        metadata: {
          customerEmail,
          error: approvalEmailResult.reason?.message || String(approvalEmailResult.reason),
        },
      });
    }
  });
}

export function queueResendOnboardingInviteEmail({
  adminId,
  contractId,
  customerEmail,
  customerName,
  contractReference,
  onboardingUrl,
  expiresAt,
}) {
  queueBackgroundTask('resend-onboarding-invite-email', async () => {
    try {
      await sendOnboardingInviteEmail({
        customerEmail,
        customerName,
        contractReference,
        onboardingUrl,
        expiresAt: new Date(expiresAt),
      });
      await writeAuditLogAfterCommit({
        actorId: adminId,
        entityType: 'contract',
        entityId: contractId,
        action: 'onboarding_sent',
        metadata: { customerEmail, expiresAt },
      });
    } catch (error) {
      await writeAuditLogAfterCommit({
        actorId: adminId,
        entityType: 'contract',
        entityId: contractId,
        action: 'onboarding_send_failed',
        metadata: {
          customerEmail,
          expiresAt,
          error: error.message || String(error),
        },
      });
    }
  });
}

export function queueContractSigningEmails({
  customerEmail,
  customerName,
  contractReference,
  signerRole,
  lifecycleStatus,
  activationState,
}) {
  if (!customerEmail) return;

  queueBackgroundTask('contract-signing-emails', async () => {
    const emailService = getEmailService();
    const tasks = [
      emailService.sendContractSigned({
        to: customerEmail,
        variables: {
          signerRole,
          contractReference,
          lifecycleStatus,
        },
      }),
    ];

    if (activationState) {
      tasks.push(
        emailService.sendFullyExecuted({
          to: customerEmail,
          variables: {
            customerName,
            contractReference,
          },
        }),
      );
    }

    const results = await Promise.allSettled(tasks);
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error('[BackgroundEmail] contract signing delivery failed', {
          contractReference,
          emailType: index === 0 ? 'contract-signed' : 'fully-executed',
          error: result.reason?.message || String(result.reason),
        });
      }
    });
  });
}

function getOnboardingUrl(token) {
  return `${env.frontendOrigin.replace(/\/+$/, '')}/onboard?token=${encodeURIComponent(token)}`;
}

async function createContract(conn, { deal, customerUserId, startDate }) {
  const now = new Date();
  const start = startDate ? new Date(`${startDate}T00:00:00`) : now;
  const end = new Date(start);
  end.setMonth(end.getMonth() + (Number(deal.term_months) || 36));
  const nextPayment = new Date(start);
  nextPayment.setMonth(nextPayment.getMonth() + 1);
  const snapshot = buildContractSnapshot(deal);
  const documentHash = hashSnapshot(snapshot);
  const referenceNumber = makeReference('CON');

  const inserted = await conn.execute(
    `INSERT INTO contracts (
       id, deal_id, originator_id, customer_id, customer_name, asset_description, asset_value,
       monthly_payment, term_months, start_date, end_date, next_payment_date, status,
       lifecycle_status, reference_number, version, document_hash, content_snapshot,
       immutable_at, created_at, updated_at
     ) VALUES (
       SYS_GUID(), HEXTORAW(:deal_id), HEXTORAW(:originator_id), HEXTORAW(:customer_id), :customer_name,
       :asset_description, :asset_value, :monthly_payment, :term_months, :start_date, :end_date, :next_payment_date,
       'pending', :lifecycle_status, :reference_number, 1, :document_hash, :content_snapshot, SYSTIMESTAMP,
       SYSTIMESTAMP, SYSTIMESTAMP
     )
     RETURNING id INTO :out_id`,
    {
      deal_id: deal.id,
      originator_id: deal.originator_id,
      customer_id: customerUserId,
      customer_name: deal.customer_name,
      asset_description: `${deal.asset_year || ''} ${deal.asset_make || ''} ${deal.asset_model || ''}`.trim() || deal.asset_type || deal.product_type,
      asset_value: Number(deal.asset_value || 0),
      monthly_payment: Number(deal.monthly_payment || 0),
      term_months: Number(deal.term_months || 36),
      start_date: start,
      end_date: end,
      next_payment_date: nextPayment,
      lifecycle_status: CONTRACT_LIFECYCLE.AWAITING_CUSTOMER_SIGNATURE,
      reference_number: referenceNumber,
      document_hash: documentHash,
      content_snapshot: JSON.stringify(snapshot),
      out_id: { dir: oracledb.BIND_OUT, type: oracledb.BUFFER },
    },
  );

  const contractId = inserted.outBinds.out_id[0].toString('hex');

  for (let index = 0; index < (Number(deal.term_months) || 36); index += 1) {
    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + index + 1);
    await conn.execute(
      `INSERT INTO payment_schedule (
         id, contract_id, payment_number, due_date, amount, status, created_at
       ) VALUES (
         SYS_GUID(), HEXTORAW(:contract_id), :payment_number, :due_date, :amount, 'upcoming', SYSTIMESTAMP
       )`,
      {
        contract_id: contractId,
        payment_number: index + 1,
        due_date: dueDate,
        amount: Number(deal.monthly_payment || 0),
      },
    );
  }

  return { contractId, contractReference: referenceNumber, documentHash };
}

async function createOrRefreshOnboardingInvite(conn, {
  adminId,
  contractId,
  customerUserId,
}) {
  const { plainToken, expiresAt } = await createOnboardingToken(conn, {
    userId: customerUserId,
    contractId,
    adminId,
  });
  const onboardingUrl = getOnboardingUrl(plainToken);
  return { onboardingUrl, expiresAt };
}

export function deriveApr({ productFamily, payload, proposedApr }) {
  if (Number.isFinite(Number(proposedApr)) && Number(proposedApr) > 0) return Number(proposedApr);
  if (Number.isFinite(Number(payload?.apr)) && Number(payload.apr) > 0) return Number(payload.apr);
  const defaults = {
    asset_finance: 7.2,
    vehicle_finance: 8.1,
    equipment_leasing: 6.8,
    working_capital: 10.5,
    invoice_finance: 9.4,
  };
  return defaults[productFamily] || 7.2;
}

export async function approveDealTransaction(conn, { dealId, adminId, adminNotes, startDate, customerEmail }) {
  const dealResult = await conn.execute(
    'SELECT * FROM deals WHERE id = HEXTORAW(:id) FOR UPDATE',
    { id: dealId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const deal = dealResult.rows?.[0] ? normalizeRecord(dealResult.rows[0]) : null;
  if (!deal) throw new Error('Deal not found');
  if (![DEAL_LIFECYCLE.PENDING_APPROVAL, 'submitted', 'under_review'].includes(deal.lifecycle_status || deal.status)) {
    const existingContract = await loadExistingContract(conn, dealId);
    if (!existingContract) throw new Error('Deal is not pending approval');
    const signatureStatus = await countSignatures(conn, existingContract.id);
    return {
      dealId,
      contractId: existingContract.id,
      contractReference: existingContract.reference_number,
      customerEmail: deal.customer_email || deal.temp_customer_email,
      onboardingInvite: null,
      signatureStatus: {
        ...signatureStatus,
        lifecycleStatus: existingContract.lifecycle_status,
      },
      idempotent: true,
    };
  }

  const resolvedEmail = customerEmail || deal.customer_email || deal.temp_customer_email;
  if (!resolvedEmail) throw new Error('Customer email is required to approve this deal');

  const customer = await ensureCustomerUser(conn, {
    email: resolvedEmail,
    customerName: deal.customer_name,
  });
  const { contractId, contractReference } = await createContract(conn, {
    deal,
    customerUserId: customer.userId,
    startDate,
  });

  await conn.execute(
    `UPDATE deals
     SET status = 'approved',
         lifecycle_status = :lifecycle_status,
         admin_notes = :admin_notes,
         customer_email = :customer_email,
         temp_customer_email = :customer_email,
         reviewed_by = HEXTORAW(:reviewed_by),
         reviewed_at = SYSTIMESTAMP,
         updated_at = SYSTIMESTAMP
     WHERE id = HEXTORAW(:id)`,
    {
      lifecycle_status: DEAL_LIFECYCLE.APPROVED,
      admin_notes: adminNotes || null,
      customer_email: resolvedEmail,
      reviewed_by: adminId,
      id: dealId,
    },
  );

  const onboardingInvite = await createOrRefreshOnboardingInvite(conn, {
    adminId,
    contractId,
    customerUserId: customer.userId,
  });

  await conn.execute(
    `INSERT INTO notifications (id, user_id, title, body, type, related_id, read, created_at)
     VALUES (SYS_GUID(), HEXTORAW(:user_id), :title, :body, 'deal_update', HEXTORAW(:related_id), 0, SYSTIMESTAMP)`,
    {
      user_id: deal.originator_id,
      title: `Deal approved - ${deal.reference_number || deal.originator_reference || contractReference}`,
      body: `${deal.customer_name} - ${deal.product_type} - Contract ${contractReference} is awaiting signatures.`,
      related_id: contractId,
    },
  );

  await insertAuditLog(conn, {
    actorId: adminId,
    entityType: 'deal',
    entityId: dealId,
    action: 'deal_approved',
    metadata: { contractId, customerUserId: customer.userId, customerEmail: resolvedEmail },
  });

  await insertAuditLog(conn, {
    actorId: adminId,
    entityType: 'contract',
    entityId: contractId,
    action: 'contract_created',
    metadata: { dealId, lifecycleStatus: CONTRACT_LIFECYCLE.AWAITING_CUSTOMER_SIGNATURE },
  });

  return {
    dealId,
    contractId,
    contractReference,
    customerEmail: resolvedEmail,
    onboardingInvite: {
      expiresAt: onboardingInvite.expiresAt.toISOString(),
      onboardingUrl: onboardingInvite.onboardingUrl,
    },
    signatureStatus: {
      customerSigned: false,
      adminSigned: false,
      lifecycleStatus: CONTRACT_LIFECYCLE.AWAITING_CUSTOMER_SIGNATURE,
    },
    emailDeliveryQueued: true,
    postCommitEmailJob: {
      type: 'approve-deal',
      adminId,
      dealId,
      contractId,
      customerEmail: resolvedEmail,
      customerName: deal.customer_name,
      contractReference,
      dealReference: deal.reference_number || deal.originator_reference,
      onboardingUrl: onboardingInvite.onboardingUrl,
      expiresAt: onboardingInvite.expiresAt.toISOString(),
    },
    idempotent: false,
  };
}

export async function resendOnboardingInvite(conn, { dealId, adminId, customerEmail }) {
  const contractResult = await conn.execute(
    `SELECT c.id, c.reference_number, c.customer_id, d.customer_name, d.customer_email, d.temp_customer_email
     FROM contracts c
     JOIN deals d ON d.id = c.deal_id
     WHERE d.id = HEXTORAW(:deal_id)
     FOR UPDATE`,
    { deal_id: dealId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const row = contractResult.rows?.[0] ? normalizeRecord(contractResult.rows[0]) : null;
  if (!row) throw new Error('Contract not found for this deal');
  const email = customerEmail || row.customer_email || row.temp_customer_email;
  if (!email) throw new Error('Customer email is required');

  await conn.execute(
    `UPDATE deals
     SET customer_email = :customer_email,
         temp_customer_email = :customer_email,
         updated_at = SYSTIMESTAMP
     WHERE id = HEXTORAW(:deal_id)`,
    {
      customer_email: email,
      deal_id: dealId,
    },
  );

  const onboardingInvite = await createOrRefreshOnboardingInvite(conn, {
    adminId,
    contractId: row.id,
    customerUserId: row.customer_id,
  });

  return {
    contractId: row.id,
    contractReference: row.reference_number,
    customerEmail: email,
    onboardingInvite: {
      expiresAt: onboardingInvite.expiresAt.toISOString(),
      onboardingUrl: onboardingInvite.onboardingUrl,
    },
    emailDeliveryQueued: true,
    postCommitEmailJob: {
      type: 'resend-onboarding-invite',
      adminId,
      contractId: row.id,
      customerEmail: email,
      customerName: row.customer_name,
      contractReference: row.reference_number,
      onboardingUrl: onboardingInvite.onboardingUrl,
      expiresAt: onboardingInvite.expiresAt.toISOString(),
    },
  };
}

export async function consumeOnboardingToken(conn, { token, ipAddress, userAgent }) {
  const tokenHash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
  const tokenHashPreview = tokenHash.slice(0, 12);
  const result = await conn.execute(
    `SELECT id, user_id, contract_id, expires_at, used_at, invalidated_at
     FROM onboarding_tokens
     WHERE token_hash = :token_hash
     FOR UPDATE`,
    { token_hash: tokenHash },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const row = result.rows?.[0] ? normalizeRecord(result.rows[0]) : null;
  if (!row) {
    console.error('[OnboardingConsume] token lookup failed', {
      reason: 'not_found',
      tokenHashPreview,
      tokenLength: String(token || '').length,
      ipAddress,
    });
    throw new Error('This onboarding link is invalid or has expired (reason: not_found)');
  }
  if (row.used_at) {
    if (env.nodeEnv !== 'production' && !row.invalidated_at && new Date(row.expires_at) >= new Date()) {
      console.warn('[OnboardingConsume] allowing dev replay of used token', {
        reason: 'already_used_dev_replay',
        tokenHashPreview,
        tokenId: row.id,
        usedAt: row.used_at,
        expiresAt: row.expires_at,
        ipAddress,
      });
    } else {
      console.error('[OnboardingConsume] token rejected', {
        reason: 'already_used',
        tokenHashPreview,
        tokenId: row.id,
        usedAt: row.used_at,
        invalidatedAt: row.invalidated_at,
        expiresAt: row.expires_at,
        ipAddress,
      });
      throw new Error('This onboarding link is invalid or has expired (reason: already_used)');
    }
  }
  if (row.invalidated_at) {
    console.error('[OnboardingConsume] token rejected', {
      reason: 'invalidated',
      tokenHashPreview,
      tokenId: row.id,
      usedAt: row.used_at,
      invalidatedAt: row.invalidated_at,
      expiresAt: row.expires_at,
      ipAddress,
    });
    throw new Error('This onboarding link is invalid or has expired (reason: invalidated)');
  }
  if (new Date(row.expires_at) < new Date()) {
    console.error('[OnboardingConsume] token rejected', {
      reason: 'expired',
      tokenHashPreview,
      tokenId: row.id,
      usedAt: row.used_at,
      invalidatedAt: row.invalidated_at,
      expiresAt: row.expires_at,
      now: new Date().toISOString(),
      ipAddress,
    });
    throw new Error('This onboarding link is invalid or has expired (reason: expired)');
  }

  console.log('[OnboardingConsume] token accepted', {
    tokenHashPreview,
    tokenId: row.id,
    contractId: row.contract_id,
    userId: row.user_id,
    expiresAt: row.expires_at,
    ipAddress,
  });

  await conn.execute(
    `UPDATE onboarding_tokens
     SET used_at = SYSTIMESTAMP
     WHERE id = HEXTORAW(:id)`,
    { id: row.id },
  );

  const userResult = await conn.execute(
    `SELECT id, email, role, full_name, company_name, onboarding_status,
            language_code, locale_code, primary_currency_code
     FROM users
     WHERE id = HEXTORAW(:id)`,
    { id: row.user_id },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const user = userResult.rows?.[0] ? normalizeRecord(userResult.rows[0]) : null;
  if (!user) throw new Error('Customer account not found');

  await insertAuditLog(conn, {
    actorId: row.user_id,
    entityType: 'contract',
    entityId: row.contract_id,
    action: 'onboarding_used',
    metadata: { ipAddress, userAgent },
  });

  return {
    user,
    contractId: row.contract_id,
    redirectPath: row.contract_id ? `/portal/contracts/${row.contract_id}` : '/portal/dashboard',
  };
}

export async function recordContractViewed(conn, { contractId, actorId, role }) {
  await insertAuditLog(conn, {
    actorId,
    entityType: 'contract',
    entityId: contractId,
    action: 'contract_viewed',
    metadata: { role },
  });
}

export async function signContract(conn, {
  contractId,
  signerRole,
  signerUserId,
  signerName,
  signaturePayload,
  ipAddress,
  userAgent,
}) {
  if (!['customer', 'admin'].includes(signerRole)) throw new Error('Invalid signer role');

  const contractResult = await conn.execute(
    `SELECT id, deal_id, customer_id, originator_id, customer_name, reference_number, lifecycle_status,
            status, version, document_hash
     FROM contracts
     WHERE id = HEXTORAW(:contract_id)
     FOR UPDATE`,
    { contract_id: contractId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const contract = contractResult.rows?.[0] ? normalizeRecord(contractResult.rows[0]) : null;
  if (!contract) throw new Error('Contract not found');
  if (![CONTRACT_LIFECYCLE.AWAITING_CUSTOMER_SIGNATURE, CONTRACT_LIFECYCLE.CUSTOMER_SIGNED, CONTRACT_LIFECYCLE.AWAITING_ADMIN_SIGNATURE].includes(contract.lifecycle_status)) {
    if (contract.lifecycle_status === CONTRACT_LIFECYCLE.ACTIVE) {
      return {
        lifecycleStatus: contract.lifecycle_status,
        customerSigned: true,
        adminSigned: true,
        contractActivated: true,
        idempotent: true,
      };
    }
    throw new Error('Contract is not available for signing');
  }

  if (signerRole === 'customer' && contract.customer_id !== signerUserId) {
    throw new Error('Forbidden');
  }

  const existingSignatureResult = await conn.execute(
    `SELECT id, role
     FROM signatures
     WHERE contract_id = HEXTORAW(:contract_id)
       AND role = :role
       AND document_version = :document_version
       AND invalidated_at IS NULL`,
    {
      contract_id: contractId,
      role: signerRole,
      document_version: contract.version,
    },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const existingSignature = existingSignatureResult.rows?.[0] ? normalizeRecord(existingSignatureResult.rows[0]) : null;
  if (!existingSignature) {
    await conn.execute(
      `INSERT INTO signatures (
         id, contract_id, role, user_id, signer_name, signature_payload,
         consent_text_version, signed_at, created_at, ip_address, user_agent,
         document_hash, document_version
       ) VALUES (
         SYS_GUID(), HEXTORAW(:contract_id), :role, HEXTORAW(:user_id), :signer_name, :signature_payload,
         'v1', SYSTIMESTAMP, SYSTIMESTAMP, :ip_address, :user_agent, :document_hash, :document_version
       )`,
      {
        contract_id: contractId,
        role: signerRole,
        user_id: signerUserId,
        signer_name: signerName,
        signature_payload: signaturePayload,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        document_hash: contract.document_hash,
        document_version: contract.version,
      },
    );
  }

  const signatureStatus = await countSignatures(conn, contractId);
  const nextContractLifecycle = deriveContractLifecycle(signatureStatus);
  const nextDealLifecycle = deriveDealLifecycle(signatureStatus);
  const activationState = signatureStatus.customerSigned && signatureStatus.adminSigned;

  await conn.execute(
    `UPDATE contracts
     SET signed_customer_at = CASE WHEN :customer_signed = 1 THEN COALESCE(signed_customer_at, SYSTIMESTAMP) ELSE signed_customer_at END,
         signed_admin_at = CASE WHEN :admin_signed = 1 THEN COALESCE(signed_admin_at, SYSTIMESTAMP) ELSE signed_admin_at END,
         lifecycle_status = :lifecycle_status,
         status = :status,
         updated_at = SYSTIMESTAMP
     WHERE id = HEXTORAW(:contract_id)`,
    {
      customer_signed: signatureStatus.customerSigned ? 1 : 0,
      admin_signed: signatureStatus.adminSigned ? 1 : 0,
      lifecycle_status: nextContractLifecycle,
      status: activationState ? 'active' : 'pending',
      contract_id: contractId,
    },
  );

  await conn.execute(
    `UPDATE deals
     SET lifecycle_status = :lifecycle_status,
         updated_at = SYSTIMESTAMP
     WHERE id = HEXTORAW(:deal_id)`,
    {
      lifecycle_status: nextDealLifecycle,
      deal_id: contract.deal_id,
    },
  );

  await insertAuditLog(conn, {
    actorId: signerUserId,
    entityType: 'contract',
    entityId: contractId,
    action: 'contract_signed',
    metadata: { signerRole, signerName, ipAddress, userAgent, lifecycleStatus: nextContractLifecycle },
  });

  const customerEmailResult = await conn.execute(
    `SELECT email
     FROM users
     WHERE id = HEXTORAW(:id)`,
    { id: contract.customer_id },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const customerEmail = customerEmailResult.rows?.[0]?.EMAIL || null;

  if (activationState) {
    await insertAuditLog(conn, {
      actorId: signerUserId,
      entityType: 'contract',
      entityId: contractId,
      action: 'contract_activated',
      metadata: { contractReference: contract.reference_number },
    });
    await insertAuditLog(conn, {
      actorId: signerUserId,
      entityType: 'contract',
      entityId: contractId,
      action: 'contract_fully_signed',
      metadata: { contractReference: contract.reference_number },
    });
  }

  return {
    lifecycleStatus: nextContractLifecycle,
    customerSigned: signatureStatus.customerSigned,
    adminSigned: signatureStatus.adminSigned,
    contractActivated: activationState,
    emailDeliveryQueued: Boolean(customerEmail),
    postCommitEmailJob: customerEmail ? {
      type: 'contract-signing',
      customerEmail,
      customerName: contract.customer_name,
      contractReference: contract.reference_number,
      signerRole,
      lifecycleStatus: nextContractLifecycle,
      activationState,
    } : null,
    idempotent: Boolean(existingSignature),
  };
}

export async function createClosureRequest(conn, payload) {
  const contractResult = await conn.execute(
    `SELECT id, deal_id, lifecycle_status
     FROM contracts
     WHERE id = HEXTORAW(:contract_id)
     FOR UPDATE`,
    { contract_id: payload.contractId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const contract = contractResult.rows?.[0] ? normalizeRecord(contractResult.rows[0]) : null;
  if (!contract) throw new Error('Contract not found');
  if (![CONTRACT_LIFECYCLE.ACTIVE, CONTRACT_LIFECYCLE.TERMINATION_REQUESTED].includes(contract.lifecycle_status)) {
    throw new Error('Only active contracts can be terminated');
  }

  const insert = await conn.execute(
    `INSERT INTO contract_closure_requests (
       id, contract_id, status, requested_by, requested_role, requested_at, requested_date,
       effective_end_date, reason, settlement_amount, notes, lifecycle_target, created_at, updated_at
     ) VALUES (
       SYS_GUID(), HEXTORAW(:contract_id), 'pending', HEXTORAW(:requested_by), :requested_role, SYSTIMESTAMP, :requested_date,
       :effective_end_date, :reason, :settlement_amount, :notes, :lifecycle_target, SYSTIMESTAMP, SYSTIMESTAMP
     )
     RETURNING id INTO :out_id`,
    {
      contract_id: payload.contractId,
      requested_by: payload.requestedBy,
      requested_role: payload.requestedRole,
      requested_date: payload.requestedDate ? new Date(`${payload.requestedDate}T00:00:00`) : null,
      effective_end_date: payload.effectiveEndDate ? new Date(`${payload.effectiveEndDate}T00:00:00`) : null,
      reason: payload.reason || null,
      settlement_amount: payload.settlementAmount || null,
      notes: payload.notes || null,
      lifecycle_target: payload.lifecycleTarget || 'TERMINATED',
      out_id: { dir: oracledb.BIND_OUT, type: oracledb.BUFFER },
    },
  );
  const requestId = insert.outBinds.out_id[0].toString('hex');

  await conn.execute(
    `UPDATE contracts
     SET lifecycle_status = :lifecycle_status,
         updated_at = SYSTIMESTAMP
     WHERE id = HEXTORAW(:contract_id)`,
    {
      lifecycle_status: CONTRACT_LIFECYCLE.TERMINATION_REQUESTED,
      contract_id: payload.contractId,
    },
  );

  await conn.execute(
    `UPDATE deals
     SET lifecycle_status = :lifecycle_status,
         updated_at = SYSTIMESTAMP
     WHERE id = HEXTORAW(:deal_id)`,
    {
      lifecycle_status: DEAL_LIFECYCLE.TERMINATION_REQUESTED,
      deal_id: contract.deal_id,
    },
  );

  await insertAuditLog(conn, {
    actorId: payload.requestedBy,
    entityType: 'contract',
    entityId: payload.contractId,
    action: 'termination_requested',
    metadata: { requestId, requestedRole: payload.requestedRole, reason: payload.reason, settlementAmount: payload.settlementAmount },
  });
  return requestId;
}

export async function reviewClosureRequest(conn, { requestId, reviewerId, status, reviewNotes, settlementAmount, effectiveEndDate }) {
  const closureResult = await conn.execute(
    `SELECT r.*, c.deal_id
     FROM contract_closure_requests r
     JOIN contracts c ON c.id = r.contract_id
     WHERE r.id = HEXTORAW(:id)
     FOR UPDATE`,
    { id: requestId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const closure = closureResult.rows?.[0] ? normalizeRecord(closureResult.rows[0]) : null;
  if (!closure) throw new Error('Closure request not found');

  await conn.execute(
    `UPDATE contract_closure_requests
     SET status = :status,
         settlement_amount = COALESCE(:settlement_amount, settlement_amount),
         effective_end_date = COALESCE(:effective_end_date, effective_end_date),
         reviewed_by = HEXTORAW(:reviewed_by),
         reviewed_at = SYSTIMESTAMP,
         review_notes = :review_notes,
         updated_at = SYSTIMESTAMP
     WHERE id = HEXTORAW(:id)`,
    {
      status,
      settlement_amount: settlementAmount || null,
      effective_end_date: effectiveEndDate ? new Date(`${effectiveEndDate}T00:00:00`) : null,
      reviewed_by: reviewerId,
      review_notes: reviewNotes || null,
      id: requestId,
    },
  );

  if (status === 'approved') {
    const terminalLifecycle = closure.lifecycle_target || CONTRACT_LIFECYCLE.TERMINATED;
    await conn.execute(
      `UPDATE contracts
       SET status = :status,
           lifecycle_status = :lifecycle_status,
           terminated_at = SYSTIMESTAMP,
           termination_reason = :termination_reason,
           settlement_amount = COALESCE(:settlement_amount, settlement_amount),
           termination_notes = :termination_notes,
           updated_at = SYSTIMESTAMP
       WHERE id = HEXTORAW(:contract_id)`,
      {
        status: terminalLifecycle === CONTRACT_LIFECYCLE.CLOSED ? 'completed' : 'cancelled',
        lifecycle_status: terminalLifecycle,
        termination_reason: closure.reason || 'Contract closure approved',
        settlement_amount: settlementAmount || closure.settlement_amount || null,
        termination_notes: reviewNotes || closure.notes || null,
        contract_id: closure.contract_id,
      },
    );
    await conn.execute(
      `UPDATE deals
       SET lifecycle_status = :lifecycle_status,
           updated_at = SYSTIMESTAMP
       WHERE id = HEXTORAW(:deal_id)`,
      {
        lifecycle_status: terminalLifecycle === CONTRACT_LIFECYCLE.CLOSED ? DEAL_LIFECYCLE.CLOSED : DEAL_LIFECYCLE.TERMINATED,
        deal_id: closure.deal_id,
      },
    );
    await conn.execute(
      `UPDATE payment_schedule
       SET status = CASE WHEN status = 'paid' THEN 'paid' ELSE 'cancelled' END
       WHERE contract_id = HEXTORAW(:contract_id)`,
      { contract_id: closure.contract_id },
    );
  }

  await insertAuditLog(conn, {
    actorId: reviewerId,
    entityType: 'contract',
    entityId: closure.contract_id,
    action: status === 'approved' ? 'termination' : `closure_${status}`,
    metadata: { requestId, reviewNotes, settlementAmount, effectiveEndDate },
  });

  return { contractId: closure.contract_id, status };
}

export async function terminateContractDirect(conn, { contractId, adminId, effectiveEndDate, reason, settlementAmount, notes }) {
  const requestId = await createClosureRequest(conn, {
    contractId,
    requestedBy: adminId,
    requestedRole: 'admin',
    requestedDate: effectiveEndDate,
    effectiveEndDate,
    reason,
    settlementAmount,
    notes,
    lifecycleTarget: 'TERMINATED',
  });
  await reviewClosureRequest(conn, {
    requestId,
    reviewerId: adminId,
    status: 'approved',
    reviewNotes: notes,
    settlementAmount,
    effectiveEndDate,
  });
  return requestId;
}
