import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react';
import { useDealStore } from '../../store/dealStore';
import { assetDetailsSchema } from '../../schemas';
import { FormField } from '../../components/shared/FormField';
import { useLocale } from '../../context/LocaleContext';

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

export default function P07AssetDetails() {
  const navigate = useNavigate();
  const { assetDetails, setAssetDetails, initiation } = useDealStore();
  const { formatCurrency } = useLocale();

  if (!initiation.customerName) {
    navigate('/deals/new');
    return null;
  }

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(assetDetailsSchema),
    defaultValues: {
      ...assetDetails,
      assetValue: assetDetails.assetValue || 0,
      deposit: assetDetails.deposit || 0,
      balloon: assetDetails.balloon || 0,
      termMonths: assetDetails.termMonths || 36,
      year: assetDetails.year || new Date().getFullYear(),
    },
  });

  const [assetValue, deposit, balloon, termMonths] = watch(['assetValue', 'deposit', 'balloon', 'termMonths']);
  const financed = (assetValue || 0) - (deposit || 0) - (balloon || 0);
  const monthlyRate = 0.072 / 12;
  const term = termMonths || 36;
  const monthly = financed > 0 && term > 0 ? Math.round((financed * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -term))) : 0;
  const totalPayable = monthly * term;
  const currencyCode = initiation.currencyCode || 'GBP';

  const onSubmit = (data) => {
    setAssetDetails({
      ...data,
      assetValue: Number(data.assetValue),
      deposit: Number(data.deposit),
      balloon: Number(data.balloon),
      termMonths: Number(data.termMonths),
      year: Number(data.year),
    });
    navigate('/deals/review');
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Asset Details</div>
          <div className="page-sub">Step 2 of 3 - {initiation.customerName} - {initiation.productType}</div>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate('/deals/new')}>Back</button>
      </div>

      <div className="steps-row" style={{ marginBottom: 24 }}>
        {['Initiation', 'Asset details', 'Review & submit'].map((step, index) => (
          <div key={step} className={`step ${index === 1 ? 'active' : index < 1 ? 'done' : ''}`}>
            <div className="step-dot">{index < 1 ? <Check size={12} /> : index + 1}</div>
            <div className="step-label">{step}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <form id="asset-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 16 }}>Asset information</div>
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
                <input {...register('assetValue', { valueAsNumber: true })} className="form-input" type="number" min="0" step="1000" placeholder="42000" />
              </FormField>
            </div>
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
              <FormField label={`Deposit (${currencyCode})`} error={errors.deposit?.message}>
                <input {...register('deposit', { valueAsNumber: true })} className="form-input" type="number" min="0" step="100" placeholder="0" />
              </FormField>
              <FormField label={`Balloon payment (${currencyCode})`} error={errors.balloon?.message}>
                <input {...register('balloon', { valueAsNumber: true })} className="form-input" type="number" min="0" step="100" placeholder="0" />
              </FormField>
            </div>
            {errors.deposit && <div style={{ fontSize: 11, color: 'var(--red)' }}>{errors.deposit.message}</div>}
          </div>
        </form>

        <div>
          <div className="calc-box">
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Live calculation</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['Asset value', formatCurrency(assetValue || 0, currencyCode)],
                ['Less deposit', formatCurrency(deposit || 0, currencyCode)],
                ['Less balloon', formatCurrency(balloon || 0, currencyCode)],
                ['Amount financed', formatCurrency(Math.max(0, financed), currencyCode)],
                ['APR (fixed)', '7.2%'],
                ['Term', `${term} months`],
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
