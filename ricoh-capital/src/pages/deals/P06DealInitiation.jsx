import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Info, RefreshCw } from 'lucide-react';
import { useDealStore } from '../../store/dealStore';
import { dealInitiationSchema } from '../../schemas';
import { FormField } from '../../components/shared/FormField';
import { useAuth } from '../../auth/AuthContext';
import { useLocale } from '../../context/LocaleContext';

function makeRef() {
  const year = new Date().getFullYear();
  const number = Math.floor(Math.random() * 90000 + 10000);
  return `REF-${year}-${number}`;
}

const PRODUCT_TYPES = [
  'Asset Finance - Hire Purchase',
  'Asset Finance - Finance Lease',
  'Asset Finance - Operating Lease',
  'Vehicle Finance - Hire Purchase',
  'Vehicle Finance - PCP',
  'Equipment Leasing',
  'Working Capital Loan',
  'Invoice Finance',
];

export default function P06DealInitiation() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { primaryCurrency, supportedLocales, t } = useLocale();
  const { initiation, setInitiation } = useDealStore();

  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(dealInitiationSchema),
    defaultValues: {
      ...initiation,
      originatorReference: initiation.originatorReference || makeRef(),
      currencyCode: initiation.currencyCode || primaryCurrency,
    },
  });

  useEffect(() => {
    if (!initiation.currencyCode) {
      setValue('currencyCode', primaryCurrency, { shouldDirty: false });
    }
  }, [initiation.currencyCode, primaryCurrency, setValue]);

  const currencyOptions = [...new Set(supportedLocales.map((entry) => entry.currency))];

  const onSubmit = (data) => {
    setInitiation(data);
    navigate('/deals/assets');
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{t('deals.newDeal')}</div>
          <div className="page-sub">Step 1 of 3 - Customer and product details</div>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate('/portfolio')}>Cancel</button>
      </div>

      <div className="steps-row" style={{ marginBottom: 24 }}>
        {['Initiation', 'Asset details', 'Review & submit'].map((step, index) => (
          <div key={step} className={`step ${index === 0 ? 'active' : ''}`}>
            <div className="step-dot">{index + 1}</div>
            <div className="step-label">{step}</div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {profile?.company_name && (
          <div className="info-banner blue" style={{ marginBottom: 16 }}>
            <Info size={14} style={{ color: 'var(--blue)', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12 }}>
              Submitting as <strong>{profile.company_name}</strong>. The customer details below are for the end-client being financed.
            </div>
          </div>
        )}

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 16 }}>End-client information</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Client / company name" required error={errors.customerName?.message} hint="The company or individual being financed">
              <input {...register('customerName')} className="form-input" placeholder="TechWorks Solutions Ltd" autoFocus />
            </FormField>
            <FormField label="Client email" error={errors.customerEmail?.message} hint="Used to invite the client to the customer portal after approval">
              <input {...register('customerEmail')} className="form-input" type="email" placeholder="contact@techworks.co.uk" />
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '0 16px' }}>
            <FormField label="Product type" required error={errors.productType?.message}>
              <select {...register('productType')} className="form-input">
                {PRODUCT_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
            </FormField>
            <FormField label={t('deals.dealCurrency')} required error={errors.currencyCode?.message}>
              <select {...register('currencyCode')} className="form-input">
                {currencyOptions.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </FormField>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 16 }}>Deal reference</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Your reference" hint="Auto-generated - you can edit if needed">
              <div style={{ display: 'flex', gap: 6 }}>
                <input {...register('originatorReference')} className="form-input" style={{ fontFamily: "'DM Mono', monospace", fontSize: 13 }} />
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ flexShrink: 0, padding: '0 10px' }}
                  title="Generate new reference"
                  onClick={() => setValue('originatorReference', makeRef(), { shouldDirty: true })}
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </FormField>
            <FormField label="Preferred start date" error={errors.preferredStartDate?.message}>
              <input {...register('preferredStartDate')} className="form-input" type="date" />
            </FormField>
          </div>
          <FormField label="Additional notes" error={errors.notes?.message}>
            <textarea {...register('notes')} className="form-input" rows={3} placeholder="Any background or context about this deal..." style={{ resize: 'vertical' }} />
          </FormField>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary">Continue - Asset details</button>
        </div>
      </form>
    </div>
  );
}
