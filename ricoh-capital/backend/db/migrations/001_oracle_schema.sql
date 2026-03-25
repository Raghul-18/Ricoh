-- Oracle Autonomous DB baseline schema replacing legacy platform coupling.

CREATE TABLE users (
  id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  email VARCHAR2(255) UNIQUE NOT NULL,
  password_hash VARCHAR2(255) NOT NULL,
  full_name VARCHAR2(255),
  company_name VARCHAR2(255),
  role VARCHAR2(30) DEFAULT 'originator' NOT NULL,
  onboarding_status VARCHAR2(30) DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  updated_at TIMESTAMP DEFAULT SYSTIMESTAMP
);

CREATE TABLE originator_applications (
  id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  user_id RAW(16) NOT NULL,
  company_name VARCHAR2(255),
  company_reg_number VARCHAR2(100),
  company_type VARCHAR2(80),
  registered_address CLOB,
  contact_first_name VARCHAR2(255),
  contact_last_name VARCHAR2(255),
  contact_email VARCHAR2(255),
  contact_job_title VARCHAR2(255),
  product_lines CLOB,
  status VARCHAR2(40) DEFAULT 'under_review',
  admin_notes CLOB,
  reviewed_by RAW(16),
  reviewed_at TIMESTAMP,
  risk_score NUMBER,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  updated_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  CONSTRAINT fk_app_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE originator_documents (
  id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  application_id RAW(16) NOT NULL,
  document_type VARCHAR2(120) NOT NULL,
  display_name VARCHAR2(255),
  file_name VARCHAR2(512),
  file_path VARCHAR2(1024),
  file_size NUMBER,
  mime_type VARCHAR2(255),
  status VARCHAR2(40) DEFAULT 'uploaded',
  uploaded_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  CONSTRAINT fk_doc_application FOREIGN KEY (application_id) REFERENCES originator_applications(id)
);

CREATE TABLE verification_checks (
  id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  application_id RAW(16) NOT NULL,
  check_type VARCHAR2(120) NOT NULL,
  display_name VARCHAR2(255),
  status VARCHAR2(40) DEFAULT 'queued',
  result_detail CLOB,
  checked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  CONSTRAINT fk_check_application FOREIGN KEY (application_id) REFERENCES originator_applications(id)
);

CREATE TABLE deals (
  id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  originator_id RAW(16) NOT NULL,
  reference_number VARCHAR2(80),
  customer_name VARCHAR2(255),
  customer_email VARCHAR2(255),
  product_type VARCHAR2(120),
  originator_reference VARCHAR2(255),
  preferred_start_date DATE,
  notes CLOB,
  asset_type VARCHAR2(120),
  asset_make VARCHAR2(120),
  asset_model VARCHAR2(120),
  asset_year NUMBER,
  asset_value NUMBER,
  term_months NUMBER,
  deposit NUMBER,
  balloon NUMBER,
  rate_type VARCHAR2(80),
  monthly_payment NUMBER,
  apr NUMBER,
  total_payable NUMBER,
  status VARCHAR2(40),
  admin_notes CLOB,
  reviewed_by RAW(16),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  updated_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  CONSTRAINT fk_deal_originator FOREIGN KEY (originator_id) REFERENCES users(id)
);

CREATE TABLE contracts (
  id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  deal_id RAW(16) NOT NULL,
  originator_id RAW(16) NOT NULL,
  customer_id RAW(16),
  customer_name VARCHAR2(255),
  asset_description VARCHAR2(500),
  asset_value NUMBER,
  monthly_payment NUMBER,
  term_months NUMBER,
  start_date DATE,
  end_date DATE,
  next_payment_date DATE,
  status VARCHAR2(40),
  reference_number VARCHAR2(80),
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  updated_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  CONSTRAINT fk_contract_deal FOREIGN KEY (deal_id) REFERENCES deals(id)
);

CREATE TABLE payment_schedule (
  id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  contract_id RAW(16) NOT NULL,
  payment_number NUMBER,
  due_date DATE,
  amount NUMBER,
  status VARCHAR2(40),
  paid_at TIMESTAMP,
  amount_paid NUMBER,
  extra_principal NUMBER,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  CONSTRAINT fk_payment_contract FOREIGN KEY (contract_id) REFERENCES contracts(id)
);

CREATE TABLE prospects (
  id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  originator_id RAW(16) NOT NULL,
  assigned_to RAW(16),
  company_name VARCHAR2(255),
  contact_name VARCHAR2(255),
  contact_email VARCHAR2(255),
  status VARCHAR2(60),
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  updated_at TIMESTAMP DEFAULT SYSTIMESTAMP
);

CREATE TABLE prospect_activities (
  id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  prospect_id RAW(16) NOT NULL,
  activity_type VARCHAR2(80),
  description CLOB,
  created_by RAW(16),
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP
);

CREATE TABLE quotes (
  id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  originator_id RAW(16) NOT NULL,
  prospect_id RAW(16),
  reference_number VARCHAR2(80),
  customer_name VARCHAR2(255),
  status VARCHAR2(40),
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  updated_at TIMESTAMP DEFAULT SYSTIMESTAMP
);

CREATE TABLE notifications (
  id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  user_id RAW(16) NOT NULL,
  title VARCHAR2(255),
  body CLOB,
  type VARCHAR2(80),
  related_id RAW(16),
  read NUMBER(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP
);

CREATE TABLE audit_logs (
  id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  entity_type VARCHAR2(80),
  entity_id RAW(16),
  action VARCHAR2(120),
  performed_by RAW(16),
  details CLOB,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP
);

CREATE TABLE deal_amendments (
  id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  deal_id RAW(16) NOT NULL,
  contract_id RAW(16),
  requested_by RAW(16),
  amendment_type VARCHAR2(120),
  description CLOB,
  status VARCHAR2(40) DEFAULT 'pending',
  admin_notes CLOB,
  reviewed_by RAW(16),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP
);
