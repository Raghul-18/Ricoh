export const PRODUCT_OPTIONS = [
  { label: 'Asset Finance - Hire Purchase', family: 'asset_finance' },
  { label: 'Asset Finance - Finance Lease', family: 'asset_finance' },
  { label: 'Asset Finance - Operating Lease', family: 'asset_finance' },
  { label: 'Vehicle Finance - Hire Purchase', family: 'vehicle_finance' },
  { label: 'Vehicle Finance - PCP', family: 'vehicle_finance' },
  { label: 'Equipment Leasing', family: 'equipment_leasing' },
  { label: 'Working Capital Loan', family: 'working_capital' },
  { label: 'Invoice Finance', family: 'invoice_finance' },
];

export const PRODUCT_FAMILY_LABELS = {
  asset_finance: 'Asset finance',
  vehicle_finance: 'Vehicle finance',
  equipment_leasing: 'Equipment leasing',
  working_capital: 'Working capital',
  invoice_finance: 'Invoice finance',
};

const DEFAULT_APR = {
  asset_finance: 7.2,
  vehicle_finance: 8.1,
  equipment_leasing: 6.8,
  working_capital: 10.5,
  invoice_finance: 9.4,
};

export function getProductFamily(productType) {
  return PRODUCT_OPTIONS.find((option) => option.label === productType)?.family || 'asset_finance';
}

export function getDefaultApr(productFamily) {
  return DEFAULT_APR[productFamily] || 7.2;
}

export function createDefaultDealPayload(productFamily = 'asset_finance') {
  switch (productFamily) {
    case 'vehicle_finance':
      return {
        assetType: 'Commercial vehicle',
        make: '',
        model: '',
        year: new Date().getFullYear(),
        assetValue: 0,
        deposit: 0,
        balloon: 0,
        termMonths: 48,
        rateType: 'Fixed',
        apr: getDefaultApr(productFamily),
      };
    case 'equipment_leasing':
      return {
        assetType: 'Plant & machinery',
        supplierName: '',
        equipmentDescription: '',
        assetValue: 0,
        deposit: 0,
        termMonths: 36,
        rateType: 'Fixed',
        apr: getDefaultApr(productFamily),
      };
    case 'working_capital':
      return {
        facilityAmount: 0,
        purpose: '',
        repaymentFrequency: 'Monthly',
        termMonths: 12,
        rateType: 'Fixed',
        apr: getDefaultApr(productFamily),
      };
    case 'invoice_finance':
      return {
        facilityAmount: 0,
        averageMonthlyInvoices: 0,
        advanceRatePct: 85,
        debtorBookValue: 0,
        repaymentFrequency: 'Monthly',
        termMonths: 12,
        rateType: 'Variable',
        apr: getDefaultApr(productFamily),
      };
    case 'asset_finance':
    default:
      return {
        assetType: 'Commercial vehicle',
        make: '',
        model: '',
        year: new Date().getFullYear(),
        assetValue: 0,
        deposit: 0,
        balloon: 0,
        termMonths: 36,
        rateType: 'Fixed',
        apr: getDefaultApr(productFamily),
      };
  }
}

export function getPrincipalAmount(payload = {}, productFamily = 'asset_finance') {
  if (productFamily === 'working_capital' || productFamily === 'invoice_finance') {
    return Number(payload.facilityAmount || 0);
  }
  return Number(payload.assetValue || 0);
}

export function getFinancedAmount(payload = {}, productFamily = 'asset_finance') {
  const principal = getPrincipalAmount(payload, productFamily);
  if (productFamily === 'working_capital' || productFamily === 'invoice_finance') {
    return principal;
  }
  return Math.max(0, principal - Number(payload.deposit || 0) - Number(payload.balloon || 0));
}

export function calcMonthlyPayment(payload = {}, productFamily = 'asset_finance') {
  const financed = getFinancedAmount(payload, productFamily);
  const termMonths = Number(payload.termMonths || 0);
  const apr = Number(payload.apr || getDefaultApr(productFamily));
  if (financed <= 0 || termMonths <= 0) return 0;
  const monthlyRate = apr / 100 / 12;
  if (!monthlyRate) return Math.round(financed / termMonths);
  return Math.round((financed * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths)));
}

export function calcTotalPayable(payload = {}, productFamily = 'asset_finance') {
  return calcMonthlyPayment(payload, productFamily) * Number(payload.termMonths || 0);
}

export function buildAssetSummary(payload = {}, productFamily = 'asset_finance') {
  if (productFamily === 'working_capital') {
    return payload.purpose || 'Working capital facility';
  }
  if (productFamily === 'invoice_finance') {
    return 'Invoice finance facility';
  }
  if (productFamily === 'equipment_leasing') {
    return payload.equipmentDescription || payload.assetType || 'Equipment lease';
  }
  return `${payload.year || ''} ${payload.make || ''} ${payload.model || ''}`.trim() || payload.assetType || 'Asset finance';
}
