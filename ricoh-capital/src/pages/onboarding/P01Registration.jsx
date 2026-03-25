import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../auth/AuthContext';
import { useRedirectWhenApproved } from '../../hooks/useRedirectWhenApproved';
import { useSaveRegistration } from '../../hooks/useOnboarding';
import { useOnboardingStore } from '../../store/onboardingStore';
import { registrationSchema } from '../../schemas';
import { FormField, LoadingSpinner } from '../../components/shared/FormField';

const COMPANY_TYPES = [
  'Limited company (Ltd)', 'Public limited company (PLC)',
  'Limited liability partnership (LLP)', 'Partnership', 'Sole trader',
];

const PRODUCT_LINES = [
  { id: 'asset_finance',   label: 'Asset Finance',     desc: 'Hire purchase, finance lease' },
  { id: 'equipment_lease', label: 'Equipment Leasing', desc: 'Operating lease, short-term rental' },
  { id: 'vehicle_finance', label: 'Vehicle Finance',   desc: 'Cars, vans, commercial vehicles' },
  { id: 'working_capital', label: 'Working Capital',   desc: 'Business loans, revolving credit' },
  { id: 'invoice_finance', label: 'Invoice Finance',   desc: 'Factoring, invoice discounting' },
];

const STEPS = ['Registration', 'Documents', 'Verification', 'Review', 'Welcome'];

export default function P01Registration() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  useRedirectWhenApproved();
  // registration is persisted in Zustand (localStorage) — pre-fills on revisit
  const { registration } = useOnboardingStore();
  const saveRegistration = useSaveRegistration();

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(registrationSchema),
    defaultValues: registration,
  });

  const selectedProducts = watch('productLines') || [];

  // Pre-fill contact fields from auth profile if not already filled
  useEffect(() => {
    if (!registration.contactEmail && profile?.email) {
      setValue('contactEmail', profile.email);
    }
    if (!registration.contactFirstName && profile?.full_name) {
      const [first, ...rest] = profile.full_name.split(' ');
      setValue('contactFirstName', first || '');
      setValue('contactLastName', rest.join(' ') || '');
    }
    if (!registration.companyName && profile?.company_name) {
      setValue('companyName', profile.company_name);
    }
  }, [profile]);

  const toggleProduct = (productId) => {
    const updated = selectedProducts.includes(productId)
      ? selectedProducts.filter(p => p !== productId)
      : [...selectedProducts, productId];
    setValue('productLines', updated, { shouldValidate: true });
  };

  // "Save & continue" only writes to Zustand — zero DB calls at this point
  const onSubmit = async (data) => {
    await saveRegistration.mutateAsync(data);
    navigate('/onboarding/documents');
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Originator Registration</div>
          <div className="page-sub">Tell us about your firm — all fields marked * are required</div>
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={signOut}>Sign out</button>
      </div>

      <div className="steps-row" style={{ marginBottom: 28 }}>
        {STEPS.map((s, i) => (
          <div key={s} className={`step ${i === 0 ? 'active' : ''}`}>
            <div className="step-dot">{i + 1}</div>
            <div className="step-label">{s}</div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 13 }}>Company information</div>
          <div className="two-col-equal" style={{ gap: '0 16px' }}>
            <FormField label="Registered company name" required error={errors.companyName?.message}>
              <input {...register('companyName')} className="form-input" placeholder="Acme Finance Ltd" autoFocus />
            </FormField>
            <FormField label="Companies House number" required error={errors.companyRegNumber?.message}
              hint="E.g. 01234567 — 8 characters">
              <input {...register('companyRegNumber')} className="form-input" placeholder="01234567" />
            </FormField>
          </div>
          <FormField label="Company type" required error={errors.companyType?.message}>
            <select {...register('companyType')} className="form-input">
              {COMPANY_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </FormField>
          <FormField label="Registered address" required error={errors.registeredAddress?.message}>
            <textarea {...register('registeredAddress')} className="form-input" rows={2}
              placeholder="123 High Street, London, EC1A 1BB" style={{ resize: 'vertical' }} />
          </FormField>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 13 }}>Primary contact</div>
          <div className="two-col-equal" style={{ gap: '0 16px' }}>
            <FormField label="First name" required error={errors.contactFirstName?.message}>
              <input {...register('contactFirstName')} className="form-input" placeholder="Jane" />
            </FormField>
            <FormField label="Last name" required error={errors.contactLastName?.message}>
              <input {...register('contactLastName')} className="form-input" placeholder="Smith" />
            </FormField>
          </div>
          <div className="two-col-equal" style={{ gap: '0 16px' }}>
            <FormField label="Work email" required error={errors.contactEmail?.message}>
              <input {...register('contactEmail')} className="form-input" type="email" placeholder="jane@company.com" />
            </FormField>
            <FormField label="Job title" error={errors.contactJobTitle?.message}>
              <input {...register('contactJobTitle')} className="form-input" placeholder="Director of Finance" />
            </FormField>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Product lines <span className="req">*</span></div>
          <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 14 }}>
            Select all products your firm will originate through Zoro Capital
          </div>
          {errors.productLines && (
            <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 10 }}>{errors.productLines.message}</div>
          )}
          <div className="two-col-equal" style={{ gap: 10 }}>
            {PRODUCT_LINES.map(p => {
              const active = selectedProducts.includes(p.id);
              return (
                <div key={p.id} className={`prod-card ${active ? 'active' : ''}`}
                  onClick={() => toggleProduct(p.id)} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{p.label}</span>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      border: `2px solid ${active ? 'var(--coral)' : 'var(--bdr)'}`,
                      background: active ? 'var(--coral)' : 'transparent',
                      transition: '.15s',
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{p.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? <><LoadingSpinner /> Saving…</> : 'Save & continue →'}
          </button>
        </div>
      </form>
    </div>
  );
}
