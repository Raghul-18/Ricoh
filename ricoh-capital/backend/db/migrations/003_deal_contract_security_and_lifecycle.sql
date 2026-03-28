ALTER TABLE users ADD (
  language_code VARCHAR2(10),
  locale_code VARCHAR2(20),
  primary_currency_code VARCHAR2(10)
);

ALTER TABLE deals ADD (
  product_family VARCHAR2(60),
  deal_payload CLOB,
  proposed_apr NUMBER,
  temp_customer_email VARCHAR2(255)
);

UPDATE deals
SET product_family = CASE
  WHEN product_type LIKE 'Vehicle Finance%' THEN 'vehicle_finance'
  WHEN product_type = 'Equipment Leasing' THEN 'equipment_leasing'
  WHEN product_type = 'Working Capital Loan' THEN 'working_capital'
  WHEN product_type = 'Invoice Finance' THEN 'invoice_finance'
  ELSE 'asset_finance'
END
WHERE product_family IS NULL;

UPDATE deals
SET deal_payload = JSON_OBJECT(
  'assetType' VALUE asset_type,
  'make' VALUE asset_make,
  'model' VALUE asset_model,
  'year' VALUE asset_year,
  'assetValue' VALUE asset_value,
  'termMonths' VALUE term_months,
  'deposit' VALUE deposit,
  'balloon' VALUE balloon,
  'rateType' VALUE rate_type,
  'apr' VALUE COALESCE(apr, proposed_apr, 7.2)
)
WHERE deal_payload IS NULL;

ALTER TABLE deals MODIFY product_family VARCHAR2(60) NOT NULL;

ALTER TABLE deals ADD CONSTRAINT chk_deals_product_family
CHECK (product_family IN ('asset_finance', 'vehicle_finance', 'equipment_leasing', 'working_capital', 'invoice_finance'));

ALTER TABLE contracts ADD (
  lifecycle_status VARCHAR2(40) DEFAULT 'pending_signatures',
  signed_customer_at TIMESTAMP,
  signed_admin_at TIMESTAMP,
  terminated_at TIMESTAMP,
  termination_reason VARCHAR2(255),
  settlement_amount NUMBER,
  termination_notes CLOB
);

UPDATE contracts
SET lifecycle_status = CASE
  WHEN status = 'active' THEN 'active'
  WHEN status = 'cancelled' THEN 'terminated'
  WHEN status = 'completed' THEN 'completed'
  ELSE 'pending_signatures'
END
WHERE lifecycle_status IS NULL;

ALTER TABLE contracts ADD CONSTRAINT chk_contract_lifecycle_status
CHECK (lifecycle_status IN ('pending_signatures', 'partially_signed', 'active', 'terminated', 'completed', 'overdue', 'maturing'));

CREATE TABLE contract_signatures (
  id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  contract_id RAW(16) NOT NULL,
  signer_role VARCHAR2(20) NOT NULL,
  signer_user_id RAW(16),
  signer_name VARCHAR2(255) NOT NULL,
  signature_payload CLOB NOT NULL,
  consent_text_version VARCHAR2(40) DEFAULT 'v1' NOT NULL,
  signed_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT fk_contract_signature_contract FOREIGN KEY (contract_id) REFERENCES contracts(id),
  CONSTRAINT chk_contract_signature_role CHECK (signer_role IN ('customer', 'admin'))
);

CREATE UNIQUE INDEX uq_contract_signatures_contract_role
ON contract_signatures (contract_id, signer_role);

CREATE TABLE contract_closure_requests (
  id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  contract_id RAW(16) NOT NULL,
  status VARCHAR2(30) DEFAULT 'pending' NOT NULL,
  requested_by RAW(16),
  requested_role VARCHAR2(20) NOT NULL,
  requested_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  requested_date DATE,
  effective_end_date DATE,
  reason VARCHAR2(255),
  settlement_amount NUMBER,
  notes CLOB,
  reviewed_by RAW(16),
  reviewed_at TIMESTAMP,
  review_notes CLOB,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT fk_contract_closure_contract FOREIGN KEY (contract_id) REFERENCES contracts(id),
  CONSTRAINT chk_contract_closure_status CHECK (status IN ('pending', 'approved', 'declined', 'cancelled')),
  CONSTRAINT chk_contract_closure_role CHECK (requested_role IN ('customer', 'admin'))
);

CREATE TABLE customer_access_credentials (
  id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  contract_id RAW(16) NOT NULL,
  user_id RAW(16) NOT NULL,
  email VARCHAR2(255) NOT NULL,
  temp_password_hash VARCHAR2(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP,
  created_by RAW(16),
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT fk_customer_credentials_contract FOREIGN KEY (contract_id) REFERENCES contracts(id),
  CONSTRAINT fk_customer_credentials_user FOREIGN KEY (user_id) REFERENCES users(id)
);
