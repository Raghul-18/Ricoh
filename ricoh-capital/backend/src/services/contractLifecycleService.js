import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import oracledb from 'oracledb';

function makeTempPassword(length = 12) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function rowToHex(row) {
  return Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [key.toLowerCase(), Buffer.isBuffer(value) ? value.toString('hex') : value]),
  );
}

async function getUserByEmail(conn, email) {
  const result = await conn.execute(
    `SELECT id, email, role, full_name, onboarding_status
     FROM users
     WHERE LOWER(email) = LOWER(:email)`,
    { email },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return result.rows?.[0] ? rowToHex(result.rows[0]) : null;
}

async function ensureCustomerUser(conn, { email, customerName }) {
  const existing = await getUserByEmail(conn, email);
  if (existing) {
    if (existing.role !== 'customer') {
      await conn.execute(
        `UPDATE users
         SET role = 'customer', full_name = COALESCE(full_name, :full_name), updated_at = SYSTIMESTAMP
         WHERE id = HEXTORAW(:id)`,
        { full_name: customerName, id: existing.id },
      );
    }
    return { userId: existing.id, email: existing.email, generatedPassword: null, isExisting: true };
  }

  const tempPassword = makeTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const inserted = await conn.execute(
    `INSERT INTO users (
       id, email, password_hash, full_name, role, onboarding_status, created_at, updated_at
     ) VALUES (
       SYS_GUID(), :email, :password_hash, :full_name, 'customer', 'approved', SYSTIMESTAMP, SYSTIMESTAMP
     )
     RETURNING id INTO :out_id`,
    {
      email,
      password_hash: passwordHash,
      full_name: customerName,
      out_id: { dir: oracledb.BIND_OUT, type: oracledb.BUFFER },
    },
  );
  return {
    userId: inserted.outBinds.out_id[0].toString('hex'),
    email,
    generatedPassword: tempPassword,
    isExisting: false,
  };
}

async function insertAuditLog(conn, { entityType, entityId, action, performedBy, details }) {
  await conn.execute(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, performed_by, details, created_at)
     VALUES (SYS_GUID(), :entity_type, ${entityId ? 'HEXTORAW(:entity_id)' : 'NULL'}, :action, ${performedBy ? 'HEXTORAW(:performed_by)' : 'NULL'}, :details, SYSTIMESTAMP)`,
    {
      entity_type: entityType,
      entity_id: entityId || null,
      action,
      performed_by: performedBy || null,
      details: JSON.stringify(details || {}),
    },
  );
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
  const deal = dealResult.rows?.[0] ? rowToHex(dealResult.rows[0]) : null;
  if (!deal) throw new Error('Deal not found');
  if (!['submitted', 'under_review'].includes(deal.status)) throw new Error('Deal is not pending approval');

  const email = customerEmail || deal.customer_email;
  if (!email) throw new Error('Customer email is required to approve this deal');

  const customer = await ensureCustomerUser(conn, { email, customerName: deal.customer_name });
  const now = new Date();
  const start = startDate ? new Date(`${startDate}T00:00:00`) : now;
  const end = new Date(start);
  end.setMonth(end.getMonth() + (Number(deal.term_months) || 36));
  const nextPayment = new Date(start);
  nextPayment.setMonth(nextPayment.getMonth() + 1);
  const contractRef = `CON-${now.getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  await conn.execute(
    `UPDATE deals
     SET status = 'approved',
         admin_notes = :admin_notes,
         customer_email = :customer_email,
         reviewed_by = HEXTORAW(:reviewed_by),
         reviewed_at = SYSTIMESTAMP,
         updated_at = SYSTIMESTAMP
     WHERE id = HEXTORAW(:id)`,
    {
      admin_notes: adminNotes || null,
      customer_email: email,
      reviewed_by: adminId,
      id: dealId,
    },
  );

  const contractInsert = await conn.execute(
    `INSERT INTO contracts (
       id, deal_id, originator_id, customer_id, customer_name, asset_description, asset_value,
       monthly_payment, term_months, start_date, end_date, next_payment_date, status, lifecycle_status,
       reference_number, created_at, updated_at
     ) VALUES (
       SYS_GUID(), HEXTORAW(:deal_id), HEXTORAW(:originator_id), HEXTORAW(:customer_id), :customer_name, :asset_description, :asset_value,
       :monthly_payment, :term_months, :start_date, :end_date, :next_payment_date, 'active', 'pending_signatures',
       :reference_number, SYSTIMESTAMP, SYSTIMESTAMP
     )
     RETURNING id INTO :out_id`,
    {
      deal_id: dealId,
      originator_id: deal.originator_id,
      customer_id: customer.userId,
      customer_name: deal.customer_name,
      asset_description: `${deal.asset_year || ''} ${deal.asset_make || ''} ${deal.asset_model || ''}`.trim() || deal.asset_type || deal.product_type,
      asset_value: deal.asset_value || 0,
      monthly_payment: deal.monthly_payment || 0,
      term_months: deal.term_months || 36,
      start_date: start,
      end_date: end,
      next_payment_date: nextPayment,
      reference_number: contractRef,
      out_id: { dir: oracledb.BIND_OUT, type: oracledb.BUFFER },
    },
  );
  const contractId = contractInsert.outBinds.out_id[0].toString('hex');

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
        amount: deal.monthly_payment || 0,
      },
    );
  }

  if (customer.generatedPassword) {
    const tempPasswordHash = await bcrypt.hash(customer.generatedPassword, 10);
    const expiry = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    await conn.execute(
      `INSERT INTO customer_access_credentials (
         id, contract_id, user_id, email, temp_password_hash, expires_at, created_by, created_at
       ) VALUES (
         SYS_GUID(), HEXTORAW(:contract_id), HEXTORAW(:user_id), :email, :temp_password_hash, :expires_at, HEXTORAW(:created_by), SYSTIMESTAMP
       )`,
      {
        contract_id: contractId,
        user_id: customer.userId,
        email,
        temp_password_hash: tempPasswordHash,
        expires_at: expiry,
        created_by: adminId,
      },
    );
  }

  await conn.execute(
    `INSERT INTO notifications (id, user_id, title, body, type, related_id, read, created_at)
     VALUES (SYS_GUID(), HEXTORAW(:user_id), :title, :body, 'deal_update', HEXTORAW(:related_id), 0, SYSTIMESTAMP)`,
    {
      user_id: deal.originator_id,
      title: `Deal approved - ${deal.reference_number || deal.originator_reference || contractRef}`,
      body: `${deal.customer_name} - ${deal.product_type} - Contract ${contractRef} is ready for signature.`,
      related_id: contractId,
    },
  );

  await insertAuditLog(conn, {
    entityType: 'deal',
    entityId: dealId,
    action: 'approved',
    performedBy: adminId,
    details: { contractId, customerUserId: customer.userId, customerEmail: email },
  });

  await insertAuditLog(conn, {
    entityType: 'contract',
    entityId: contractId,
    action: 'created',
    performedBy: adminId,
    details: { dealId, lifecycleStatus: 'pending_signatures' },
  });

  return {
    dealId,
    contractId,
    contractReference: contractRef,
    customerEmail: email,
    tempPassword: customer.generatedPassword,
    customerUserId: customer.userId,
    signatureStatus: {
      customerSigned: false,
      adminSigned: false,
      lifecycleStatus: 'pending_signatures',
    },
  };
}

export async function signContract(conn, { contractId, signerRole, signerUserId, signerName, signaturePayload }) {
  if (!['customer', 'admin'].includes(signerRole)) throw new Error('Invalid signer role');
  await conn.execute(
    `MERGE INTO contract_signatures target
     USING (
       SELECT HEXTORAW(:contract_id) AS contract_id, :signer_role AS signer_role FROM dual
     ) source
     ON (target.contract_id = source.contract_id AND target.signer_role = source.signer_role)
     WHEN MATCHED THEN
       UPDATE SET signer_user_id = HEXTORAW(:signer_user_id), signer_name = :signer_name, signature_payload = :signature_payload,
                  consent_text_version = 'v1', signed_at = SYSTIMESTAMP
     WHEN NOT MATCHED THEN
       INSERT (id, contract_id, signer_role, signer_user_id, signer_name, signature_payload, consent_text_version, signed_at, created_at)
       VALUES (SYS_GUID(), HEXTORAW(:contract_id), :signer_role, HEXTORAW(:signer_user_id), :signer_name, :signature_payload, 'v1', SYSTIMESTAMP, SYSTIMESTAMP)`,
    {
      contract_id: contractId,
      signer_role: signerRole,
      signer_user_id: signerUserId,
      signer_name: signerName,
      signature_payload: signaturePayload,
    },
  );

  const sigs = await conn.execute(
    `SELECT signer_role FROM contract_signatures WHERE contract_id = HEXTORAW(:contract_id)`,
    { contract_id: contractId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const roles = new Set((sigs.rows || []).map((row) => row.SIGNER_ROLE));
  const lifecycleStatus = roles.has('customer') && roles.has('admin')
    ? 'active'
    : 'partially_signed';

  await conn.execute(
    `UPDATE contracts
     SET signed_customer_at = CASE WHEN :customer_signed = 1 THEN COALESCE(signed_customer_at, SYSTIMESTAMP) ELSE signed_customer_at END,
         signed_admin_at = CASE WHEN :admin_signed = 1 THEN COALESCE(signed_admin_at, SYSTIMESTAMP) ELSE signed_admin_at END,
         lifecycle_status = :lifecycle_status,
         updated_at = SYSTIMESTAMP
     WHERE id = HEXTORAW(:contract_id)`,
    {
      customer_signed: roles.has('customer') ? 1 : 0,
      admin_signed: roles.has('admin') ? 1 : 0,
      lifecycle_status: lifecycleStatus,
      contract_id: contractId,
    },
  );

  await insertAuditLog(conn, {
    entityType: 'contract',
    entityId: contractId,
    action: `${signerRole}_signed`,
    performedBy: signerUserId,
    details: { signerName, lifecycleStatus },
  });

  return { lifecycleStatus, customerSigned: roles.has('customer'), adminSigned: roles.has('admin') };
}

export async function createClosureRequest(conn, payload) {
  const insert = await conn.execute(
    `INSERT INTO contract_closure_requests (
       id, contract_id, status, requested_by, requested_role, requested_at, requested_date,
       effective_end_date, reason, settlement_amount, notes, created_at, updated_at
     ) VALUES (
       SYS_GUID(), HEXTORAW(:contract_id), 'pending', HEXTORAW(:requested_by), :requested_role, SYSTIMESTAMP, :requested_date,
       :effective_end_date, :reason, :settlement_amount, :notes, SYSTIMESTAMP, SYSTIMESTAMP
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
      out_id: { dir: oracledb.BIND_OUT, type: oracledb.BUFFER },
    },
  );
  const requestId = insert.outBinds.out_id[0].toString('hex');
  await insertAuditLog(conn, {
    entityType: 'contract',
    entityId: payload.contractId,
    action: 'closure_requested',
    performedBy: payload.requestedBy,
    details: { requestId, requestedRole: payload.requestedRole, reason: payload.reason, settlementAmount: payload.settlementAmount },
  });
  return requestId;
}

export async function reviewClosureRequest(conn, { requestId, reviewerId, status, reviewNotes, settlementAmount, effectiveEndDate }) {
  const closureResult = await conn.execute(
    'SELECT * FROM contract_closure_requests WHERE id = HEXTORAW(:id) FOR UPDATE',
    { id: requestId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const closure = closureResult.rows?.[0] ? rowToHex(closureResult.rows[0]) : null;
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
    await conn.execute(
      `UPDATE contracts
       SET status = 'cancelled',
           lifecycle_status = 'terminated',
           terminated_at = SYSTIMESTAMP,
           termination_reason = :termination_reason,
           settlement_amount = COALESCE(:settlement_amount, settlement_amount),
           termination_notes = :termination_notes,
           updated_at = SYSTIMESTAMP
       WHERE id = HEXTORAW(:contract_id)`,
      {
        termination_reason: closure.reason || 'Contract closure approved',
        settlement_amount: settlementAmount || closure.settlement_amount || null,
        termination_notes: reviewNotes || closure.notes || null,
        contract_id: closure.contract_id,
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
    entityType: 'contract',
    entityId: closure.contract_id,
    action: `closure_${status}`,
    performedBy: reviewerId,
    details: { requestId, reviewNotes, settlementAmount, effectiveEndDate },
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
