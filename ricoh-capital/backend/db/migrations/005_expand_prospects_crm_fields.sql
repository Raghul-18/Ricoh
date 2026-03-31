ALTER TABLE prospects ADD (
  city VARCHAR2(120),
  industry VARCHAR2(120),
  annual_turnover NUMBER,
  employee_count NUMBER,
  contact_phone VARCHAR2(80),
  pipeline_stage VARCHAR2(60),
  product_interest VARCHAR2(120),
  estimated_value NUMBER,
  notes CLOB
);

UPDATE prospects
SET pipeline_stage = CASE
  WHEN status IN ('New lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost') THEN status
  WHEN status = 'new' THEN 'New lead'
  WHEN status = 'qualified' THEN 'Qualified'
  WHEN status = 'proposal' THEN 'Proposal'
  WHEN status = 'negotiation' THEN 'Negotiation'
  WHEN status = 'won' THEN 'Won'
  WHEN status = 'lost' THEN 'Lost'
  ELSE 'New lead'
END
WHERE pipeline_stage IS NULL;

ALTER TABLE prospects MODIFY pipeline_stage VARCHAR2(60) DEFAULT 'New lead' NOT NULL;

ALTER TABLE prospects ADD CONSTRAINT chk_prospects_pipeline_stage
CHECK (pipeline_stage IN ('New lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'));

INSERT INTO audit_logs (id, entity_type, entity_id, action, details, created_at)
VALUES (
  SYS_GUID(),
  'migration',
  NULL,
  'expand_prospects_crm_fields_schema_applied',
  JSON_OBJECT('migration' VALUE '005_expand_prospects_crm_fields.sql'),
  SYSTIMESTAMP
);
