import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react';
import { useDealStore } from '../../store/dealStore';
import { assetDetailsSchema } from '../../schemas';
import { FormField } from '../../components/shared/FormField';
import { useLocale } from '../../context/LocaleContext';
import {
  calcMonthlyPayment,
  calcTotalPayable,
  createDefaultDealPayload,
  getDefaultApr,
  getFinancedAmount,
} from '../../lib/dealConfig';

const ASSET_TYPES = [
  'Commercial vehicle',
  'Plant & machinery',
  'Medical equipment',
  'Catering equipment',
  'IT & technology',
  'Agricultural equipment',
  'Construction equipment',
  'Office furniture & fit-out',
  'Other',
];

const YEARS = Array.from({ length: 15 }, (_, index) => new Date().getFullYear() - index);
const TERMS = [12, 18, 24, 36, 48, 60, 72, 84, 96, 120];

function FamilyFields({ family, register, errors, currencyCode }) {
  if (family === 'working_capital') {
    return (
      <>
        <FormField label={`Facility amount (${currencyCode})`} required error={errors.facilityAmount?.message}>
          <input {...register('facilityAmount', { valueAsNumber: true })} className="form-input" type="number" min="0" step="1000" />
        </FormField>
        <FormField label="Purpose" required error={errors.purpose?.message}>
          <textarea {...register('purpose')} className="form-input" rows={3} style={{ resize: 'vertical' }} />
        </FormField>
      </>
    );
  }
  if (family === 'invoice_finance') {
    return (
      <>
        <div className="two-col-equal" style={{ gap: '0 12px' }}>
          <FormField label={`Facility amount (${currencyCode})`} required error={errors.facilityAmount?.message}>
            <input {...register('facilityAmount', { valueAsNumber: true })} className="form-input" type="number" min="0" step="1000" />
          </FormField>
          <FormField label={`Debtor book value (${currencyCode})`} error={errors.debtorBookValue?.message}>
            <input {...register('debtorBookValue', { valueAsNumber: true })} className="form-input" type="number" min="0" step="1000" />
          </FormField>
        </div>
        <div className="two-col-equal" style={{ gap: '0 12px' }}>
          <FormField label={`Average monthly invoices (${currencyCode})`} required error={errors.averageMonthlyInvoices?.message}>
            <input {...register('averageMonthlyInvoices', { valueAsNumber: true })} className="form-input" type="number" min="0" step="1000" />
          </FormField>
          <FormField label="Advance rate (%)" required error={errors.advanceRatePct?.message}>
            <input {...register('advanceRatePct', { valueAsNumber: true })} className="form-input" type="number" min="1" max="100" step="1" />
          </FormField>
        </div>
      </>
    );
  }
  if (family === 'equipment_leasing') {
    return (
      <>
        <FormField label="Equipment type" required error={errors.assetType?.message}>
          <select {...register('assetType')} className="form-input">
            {ASSET_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
        </FormField>
        <div className="two-col-equal" style={{ gap: '0 12px' }}>
          <FormField label="Supplier name" error={errors.supplierName?.message}>
            <input {...register('supplierName')} className="form-input" placeholder="Ricoh Equipment Ltd" />
          </FormField>
          <FormField label={`Equipment value (${currencyCode})`} required error={errors.assetValue?.message}>
            <input {...register('assetValue', { valueAsNumber: true })} className="form-input" type="number" min="0" step="1000" />
          </FormField>
        </div>
        <FormField label="Equipment description" required error={errors.equipmentDescription?.message}>
          <textarea {...register('equipmentDescription')} className="form-input" rows={3} style={{ resize: 'vertical' }} />
        </FormField>
      </>
    );
  }
  return (
    <>
      <FormField label="Asset type" required error={errors.assetType?.message}>
        <select {...register('assetType')} className="form-input">
          {ASSET_TYPES.map((type) => <option key={type}>{type}</option>)}
        </select>
      </FormField>
      <div className="two-col-equal" style={{ gap: '0 12px' }}>
        <FormField label="Make" required error={errors.make?.message}>
          <input {...register('make')} className="form-input" placeholder="Mercedes-Benz" />
        </FormField>
        <FormField label="Model" required error={errors.model?.message}>
          <input {...register('model')} className="form-input" placeholder="Sprinter 316 CDI" />
        </FormField>
      </div>
      <div className="two-col-equal" style={{ gap: '0 12px' }}>
        <FormField label="Year" required error={errors.year?.message}>
          <select {...register('year', { valueAsNumber: true })} className="form-input">
            {YEARS.map((year) => <option key={year}>{year}</option>)}
          </select>
        </FormField>
        <FormField label={`Asset value (${currencyCode})`} required error={errors.assetValue?.message}>
          <input {...register('assetValue', { valueAsNumber: true })} className="form-input" type="number" min="0" step="1000" />
        </FormField>
      </div>
    </>
  );
}

export default function P07AssetDetails() {
  const navigate = useNavigate();
  const { dealDetails, setDealDetails, initiation } = useDealStore();
  const { formatCurrency } = useLocale();

  if (!initiation.customerName) {
    navigate('/deals/new');
    return null;
  }

  const family = initiation.productFamily;
  const defaults = { ...createDefaultDealPayload(family), ...dealDetails, productType: initiation.productType, apr: dealDetails.apr || getDefaultApr(family) };

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(assetDetailsSchema),
    defaultValues: defaults,
  });

  const payload = watch();
  const monthly = calcMonthlyPayment(payload, family);
  const totalPayable = calcTotalPayable(payload, family);
  const financed = getFinancedAmount(payload, family);
  const currencyCode = initiation.currencyCode || 'GBP';

  const onSubmit = (data) => {
    setDealDetails({
      ...data,
      termMonths: Number(data.termMonths),
      apr: Number(data.apr),
      assetValue: Number(data.assetValue || 0),
      deposit: Number(data.deposit || 0),
      balloon: Number(data.balloon || 0),
      year: Number(data.year || 0),
      facilityAmount: Number(data.facilityAmount || 0),
      averageMonthlyInvoices: Number(data.averageMonthlyInvoices || 0),
      advanceRatePct: Number(data.advanceRatePct || 0),
      debtorBookValue: Number(data.debtorBookValue || 0),
    });
    navigate('/deals/review');
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Deal Details</div>
          <div className="page-sub">Step 2 of 3 - {initiation.customerName} - {initiation.productType}</div>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate('/deals/new')}>Back</button>
      </div>

      <div className="steps-row" style={{ marginBottom: 24 }}>
        {['Initiation', 'Deal details', 'Review & submit'].map((step, index) => (
          <div key={step} className={`step ${index === 1 ? 'active' : index < 1 ? 'done' : ''}`}>
            <div className="step-dot">{index < 1 ? <Check size={12} /> : index + 1}</div>
            <div className="step-label">{step}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <form id="asset-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 16 }}>Product-specific details</div>
            <FamilyFields family={family} register={register} errors={errors} currencyCode={currencyCode} />
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 16 }}>Finance structure</div>
            <div className="two-col-equal" style={{ gap: '0 12px' }}>
              <FormField label="Term (months)" required error={errors.termMonths?.message}>
                <select {...register('termMonths', { valueAsNumber: true })} className="form-input">
                  {TERMS.map((value) => <option key={value} value={value}>{value} months</option>)}
                </select>
              </FormField>
              <FormField label="Rate type" required error={errors.rateType?.message}>
                <select {...register('rateType')} className="form-input">
                  <option>Fixed</option>
                  <option>Variable</option>
                </select>
              </FormField>
            </div>
            <div className="two-col-equal" style={{ gap: '0 12px' }}>
              <FormField label="APR (%)" required error={errors.apr?.message}>
                <input {...register('apr', { valueAsNumber: true })} className="form-input" type="number" min="1" max="30" step="0.1" />
              </FormField>
              {family !== 'working_capital' && family !== 'invoice_finance' ? (
                <FormField label={`Deposit (${currencyCode})`} error={errors.deposit?.message}>
                  <input {...register('deposit', { valueAsNumber: true })} className="form-input" type="number" min="0" step="100" />
                </FormField>
              ) : (
                <FormField label="Repayment frequency">
                  <select {...register('repaymentFrequency')} className="form-input">
                    <option>Monthly</option>
                    <option>Quarterly</option>
                  </select>
                </FormField>
              )}
            </div>
            {(family === 'asset_finance' || family === 'vehicle_finance') && (
              <div className="two-col-equal" style={{ gap: '0 12px' }}>
                <FormField label={`Balloon payment (${currencyCode})`} error={errors.balloon?.message}>
                  <input {...register('balloon', { valueAsNumber: true })} className="form-input" type="number" min="0" step="100" />
                </FormField>
              </div>
            )}
          </div>
        </form>

        <div>
          <div className="calc-box">
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Live calculation</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['Principal amount', formatCurrency((family === 'working_capital' || family === 'invoice_finance') ? payload.facilityAmount || 0 : payload.assetValue || 0, currencyCode)],
                ['Amount financed', formatCurrency(financed, currencyCode)],
                ['APR', `${Number(payload.apr || 0).toFixed(1)}%`],
                ['Term', `${payload.termMonths || 0} months`],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--tx3)' }}>{label}</span>
                  <span style={{ fontWeight: 500 }}>{value}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--bdr)', paddingTop: 12, marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--tx3)' }}>Total payable</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{formatCurrency(totalPayable, currencyCode)}</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>Monthly payment</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--coral)' }}>{formatCurrency(monthly, currencyCode)}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)' }}>/ month</div>
                </div>
              </div>
            </div>
          </div>

          <button type="submit" form="asset-form" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>
            Review & submit
          </button>
          <button type="button" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} onClick={() => navigate('/deals/new')}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
