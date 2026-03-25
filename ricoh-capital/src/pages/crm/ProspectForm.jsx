import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { prospectSchema } from '../../schemas';
import { useCreateProspect, useUpdateProspect } from '../../hooks/useProspects';
import { FormField, LoadingSpinner } from '../../components/shared/FormField';

const STAGES = ['New lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const INDUSTRIES = ['Construction', 'Transport & logistics', 'Manufacturing', 'Healthcare', 'Food & agriculture', 'Technology', 'Professional services', 'Retail', 'Education', 'Energy', 'Other'];
const PRODUCTS = ['Asset Finance', 'Equipment Leasing', 'Vehicle Finance', 'Working Capital', 'Invoice Finance'];

export default function ProspectForm({ prospect, onSuccess, onCancel }) {
  const navigate = useNavigate();
  const create = useCreateProspect();
  const update = useUpdateProspect();
  const isEdit = !!prospect;

  const handleSuccess = () => onSuccess ? onSuccess() : navigate('/crm');
  const handleCancel = () => onCancel ? onCancel() : navigate('/crm');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(prospectSchema),
    defaultValues: prospect ? {
      companyName: prospect.company_name || '',
      city: prospect.city || '',
      industry: prospect.industry || '',
      annualTurnover: prospect.annual_turnover || null,
      employeeCount: prospect.employee_count || null,
      contactName: prospect.contact_name || '',
      contactEmail: prospect.contact_email || '',
      contactPhone: prospect.contact_phone || '',
      pipelineStage: prospect.pipeline_stage || 'New lead',
      productInterest: prospect.product_interest || '',
      estimatedValue: prospect.estimated_value || null,
      notes: prospect.notes || '',
    } : {
      companyName: '', city: '', industry: '', annualTurnover: null, employeeCount: null,
      contactName: '', contactEmail: '', contactPhone: '',
      pipelineStage: 'New lead', productInterest: '', estimatedValue: null, notes: '',
    },
  });

  const onSubmit = async (data) => {
    const payload = {
      company_name: data.companyName,
      city: data.city,
      industry: data.industry,
      annual_turnover: data.annualTurnover || null,
      employee_count: data.employeeCount || null,
      contact_name: data.contactName,
      contact_email: data.contactEmail,
      contact_phone: data.contactPhone,
      pipeline_stage: data.pipelineStage,
      product_interest: data.productInterest,
      estimated_value: data.estimatedValue || null,
      notes: data.notes,
    };
    if (isEdit) {
      await update.mutateAsync({ prospectId: prospect.id, data: payload });
    } else {
      await create.mutateAsync(payload);
    }
    handleSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="page-header">
        <div className="page-title">{isEdit ? 'Edit prospect' : 'Add new prospect'}</div>
        <button type="button" className="btn btn-ghost" onClick={handleCancel}>✕ Cancel</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Company details</div>
            <FormField label="Company name" required error={errors.companyName?.message}>
              <input {...register('companyName')} className="form-input" placeholder="Acme Corp Ltd" autoFocus />
            </FormField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <FormField label="City" error={errors.city?.message}>
                <input {...register('city')} className="form-input" placeholder="London" />
              </FormField>
              <FormField label="Industry" error={errors.industry?.message}>
                <select {...register('industry')} className="form-input">
                  <option value="">— Select —</option>
                  {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                </select>
              </FormField>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <FormField label="Annual turnover (£)" error={errors.annualTurnover?.message}>
                <input {...register('annualTurnover', { valueAsNumber: true })} className="form-input" type="number" min="0" placeholder="1000000" />
              </FormField>
              <FormField label="Employees" error={errors.employeeCount?.message}>
                <input {...register('employeeCount', { valueAsNumber: true })} className="form-input" type="number" min="0" placeholder="50" />
              </FormField>
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Contact</div>
            <FormField label="Contact name" required error={errors.contactName?.message}>
              <input {...register('contactName')} className="form-input" placeholder="Jane Smith" />
            </FormField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <FormField label="Email" error={errors.contactEmail?.message}>
                <input {...register('contactEmail')} className="form-input" type="email" placeholder="jane@acme.com" />
              </FormField>
              <FormField label="Phone" error={errors.contactPhone?.message}>
                <input {...register('contactPhone')} className="form-input" placeholder="+44 7700 900000" />
              </FormField>
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Opportunity</div>
            <FormField label="Pipeline stage" error={errors.pipelineStage?.message}>
              <select {...register('pipelineStage')} className="form-input">
                {STAGES.map(s => <option key={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Product interest" error={errors.productInterest?.message}>
              <select {...register('productInterest')} className="form-input">
                <option value="">— Select —</option>
                {PRODUCTS.map(p => <option key={p}>{p}</option>)}
              </select>
            </FormField>
            <FormField label="Estimated deal value (£)" error={errors.estimatedValue?.message}>
              <input {...register('estimatedValue', { valueAsNumber: true })} className="form-input" type="number" min="0" placeholder="50000" />
            </FormField>
          </div>

          <div className="card">
            <FormField label="Notes" error={errors.notes?.message}>
              <textarea {...register('notes')} className="form-input" rows={4} placeholder="Background context, pain points, previous conversations…" style={{ resize: 'vertical' }} />
            </FormField>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <button type="button" className="btn btn-ghost" onClick={handleCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting || create.isPending || update.isPending}>
          {(isSubmitting || create.isPending || update.isPending) ? <LoadingSpinner /> : (isEdit ? 'Save changes' : 'Add prospect →')}
        </button>
      </div>
    </form>
  );
}
