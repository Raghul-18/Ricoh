ALTER TABLE users ADD (
  must_reset NUMBER(1) DEFAULT 0 NOT NULL
);

ALTER TABLE deals ADD (
  lifecycle_status VARCHAR2(40) DEFAULT 'PENDING_APPROVAL' NOT NULL
);

UPDATE deals
SET lifecycle_status = CASE
  WHEN status = 'draft' THEN 'DRAFT'
  WHEN status IN ('submitted', 'under_review') THEN 'PENDING_APPROVAL'
  WHEN status = 'approved' THEN 'APPROVED'
  WHEN status = 'rejected' THEN 'CLOSED'
  ELSE 'PENDING_APPROVAL'
END
WHERE lifecycle_status IS NULL
   OR lifecycle_status NOT IN (
     'DRAFT',
     'PENDING_APPROVAL',
     'APPROVED',
     'AWAITING_CUSTOMER_SIGNATURE',
     'CUSTOMER_SIGNED',
     'AWAITING_ADMIN_SIGNATURE',
     'FULLY_SIGNED',
     'ACTIVE',
     'TERMINATION_REQUESTED',
     'TERMINATED',
     'CLOSED'
   );

ALTER TABLE deals ADD CONSTRAINT chk_deals_lifecycle_status
CHECK (lifecycle_status IN (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'AWAITING_CUSTOMER_SIGNATURE',
  'CUSTOMER_SIGNED',
  'AWAITING_ADMIN_SIGNATURE',
  'FULLY_SIGNED',
  'ACTIVE',
  'TERMINATION_REQUESTED',
  'TERMINATED',
  'CLOSED'
));

ALTER TABLE contracts ADD (
  version NUMBER DEFAULT 1 NOT NULL,
  document_hash VARCHAR2(128),
  content_snapshot CLOB,
  immutable_at TIMESTAMP
);

UPDATE contracts
SET lifecycle_status = CASE
  WHEN lifecycle_status IN ('active', 'ACTIVE') THEN 'ACTIVE'
  WHEN lifecycle_status IN ('partially_signed', 'CUSTOMER_SIGNED', 'AWAITING_ADMIN_SIGNATURE') THEN 'AWAITING_ADMIN_SIGNATURE'
  WHEN lifecycle_status IN ('pending_signatures', 'APPROVED', 'AWAITING_CUSTOMER_SIGNATURE') THEN 'AWAITING_CUSTOMER_SIGNATURE'
  WHEN lifecycle_status IN ('terminated', 'TERMINATED') THEN 'TERMINATED'
  WHEN lifecycle_status IN ('completed', 'CLOSED') THEN 'CLOSED'
  ELSE 'AWAITING_CUSTOMER_SIGNATURE'
END;

ALTER TABLE contracts DROP CONSTRAINT chk_contract_lifecycle_status;

ALTER TABLE contracts ADD CONSTRAINT chk_contract_lifecycle_status
CHECK (lifecycle_status IN (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'AWAITING_CUSTOMER_SIGNATURE',
  'CUSTOMER_SIGNED',
  'AWAITING_ADMIN_SIGNATURE',
  'FULLY_SIGNED',
  'ACTIVE',
  'TERMINATION_REQUESTED',
  'TERMINATED',
  'CLOSED'
));

ALTER TABLE contract_closure_requests DROP CONSTRAINT chk_contract_closure_status;

ALTER TABLE contract_closure_requests ADD CONSTRAINT chk_contract_closure_status
CHECK (status IN ('pending', 'approved', 'declined', 'cancelled'));

ALTER TABLE contract_closure_requests ADD (
  lifecycle_target VARCHAR2(40) DEFAULT 'TERMINATED' NOT NULL
);

ALTER TABLE contract_closure_requests ADD CONSTRAINT chk_contract_closure_target
CHECK (lifecycle_target IN ('TERMINATED', 'CLOSED'));

RENAME contract_signatures TO signatures;

ALTER TABLE signatures ADD (
  ip_address VARCHAR2(64),
  user_agent VARCHAR2(1024),
  document_hash VARCHAR2(128),
  document_version NUMBER DEFAULT 1 NOT NULL,
  invalidated_at TIMESTAMP
);

ALTER TABLE signatures RENAME COLUMN signer_role TO role;
ALTER TABLE signatures RENAME COLUMN signer_user_id TO user_id;

ALTER TABLE signatures DROP CONSTRAINT chk_contract_signature_role;

ALTER TABLE signatures ADD CONSTRAINT chk_signatures_role
CHECK (role IN ('customer', 'admin'));

DROP INDEX uq_contract_signatures_contract_role;

CREATE UNIQUE INDEX uq_signatures_contract_role_version
ON signatures (contract_id, role, document_version);

CREATE TABLE onboarding_tokens (
  id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  user_id RAW(16) NOT NULL,
  contract_id RAW(16),
  token_hash VARCHAR2(128) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  invalidated_at TIMESTAMP,
  created_by RAW(16),
  delivery_channel VARCHAR2(30) DEFAULT 'email' NOT NULL,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT fk_onboarding_token_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_onboarding_token_contract FOREIGN KEY (contract_id) REFERENCES contracts(id)
);

CREATE UNIQUE INDEX uq_onboarding_tokens_hash
ON onboarding_tokens (token_hash);

CREATE INDEX ix_onboarding_tokens_user
ON onboarding_tokens (user_id, expires_at);

INSERT INTO audit_logs (id, entity_type, entity_id, action, details, created_at)
VALUES (
  SYS_GUID(),
  'migration',
  NULL,
  'secure_onboarding_and_esign_schema_applied',
  JSON_OBJECT('migration' VALUE '004_secure_onboarding_and_esign.sql'),
  SYSTIMESTAMP
);
