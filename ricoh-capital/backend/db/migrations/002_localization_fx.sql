ALTER TABLE users ADD (
  language_code VARCHAR2(20),
  locale_code VARCHAR2(20),
  primary_currency_code VARCHAR2(3)
);

ALTER TABLE deals ADD (
  original_currency_code VARCHAR2(3),
  original_asset_value NUMBER,
  original_deposit NUMBER,
  original_balloon NUMBER,
  original_monthly_payment NUMBER,
  original_total_payable NUMBER,
  reporting_currency_code VARCHAR2(3),
  reporting_asset_value NUMBER,
  reporting_deposit NUMBER,
  reporting_balloon NUMBER,
  reporting_monthly_payment NUMBER,
  reporting_total_payable NUMBER,
  fx_rate NUMBER,
  fx_base_currency VARCHAR2(3),
  fx_target_currency VARCHAR2(3),
  fx_source VARCHAR2(80),
  fx_fetched_at TIMESTAMP
);
