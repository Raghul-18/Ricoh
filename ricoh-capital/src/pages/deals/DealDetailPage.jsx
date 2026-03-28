import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, CheckCircle, Clock, CreditCard, ExternalLink, FileText, Info, Plus, Send, Wrench, XCircle } from 'lucide-react';
import { useDeal } from '../../hooks/useDeals';
import { useDealAmendments, useRequestAmendment } from '../../hooks/useAmendments';
import { useAppContext } from '../../context/AppContext';
import { LoadingSpinner } from '../../components/shared/FormField';
import { useLocale } from '../../context/LocaleContext';
import { convertWithRate, useFxRate } from '../../hooks/useFx';

const AMENDMENT_TYPES = [
  { value: 'term_extension', label: 'Term extension' },
  { value: 'payment_holiday', label: 'Payment holiday' },
  { value: 'settlement', label: 'Early settlement' },
  { value: 'rate_change', label: 'Rate change' },
  { value: 'other', label: 'Other variation' },
];

const AMEND_STATUS_META = {
  pending: { label: 'Pending', color: 'var(--blue)' },
  under_review: { label: 'In review', color: 'var(--amber)' },
  approved: { label: 'Approved', color: 'var(--green)' },
  rejected: { label: 'Declined', color: 'var(--red)' },
};

const STATUS_META = {
  draft: { label: 'Draft', color: 'var(--tx3)', icon: <FileText size={16} />, step: 0 },
  submitted: { label: 'Submitted', color: 'var(--blue)', icon: <Send size={16} />, step: 1 },
  under_review: { label: 'In review', color: 'var(--amber)', icon: <Clock size={16} />, step: 2 },
  approved: { label: 'Approved', color: 'var(--green)', icon: <CheckCircle size={16} />, step: 3 },
  rejected: { label: 'Not approved', color: 'var(--red)', icon: <XCircle size={16} />, step: -1 },
};

const TIMELINE_STEPS = [
  { key: 'submitted', label: 'Deal submitted', sub: 'Sent to Ricoh Capital for review' },
  { key: 'under_review', label: 'Credit review', sub: 'A credit analyst is reviewing the deal' },
  { key: 'approved', label: 'Decision made', sub: 'Contract issued and active' },
];

function Row({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingBottom: 7, borderBottom: '1px solid var(--bdr)', marginBottom: 7 }}>
      <span style={{ color: 'var(--tx3)' }}>{label}</span>
      <span style={{ fontWeight: 500, maxWidth: 240, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function AmendmentPanel({ dealId, isApproved }) {
  const { showToast } = useAppContext();
  const { formatDate } = useLocale();
  const { data: amendments = [], isLoading } = useDealAmendments(dealId);
  const request = useRequestAmendment();
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('other');
  const [desc, setDesc] = useState('');

  const handleSubmit = async () => {
    if (!desc.trim()) return;
    try {
      await request.mutateAsync({ dealId, amendmentType: type, description: desc });
      showToast('Amendment request submitted', 'success');
      setDesc('');
      setShowForm(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>Amendment requests</div>
        {isApproved && !showForm && (
          <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setShowForm(true)}>
            <Plus size={12} /> Request variation
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--bdr)', borderRadius: 'var(--rl)', padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>New amendment request</div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--tx3)', display: 'block', marginBottom: 4 }}>Type</label>
            <select className="form-input" value={type} onChange={(event) => setType(event.target.value)} style={{ fontSize: 12 }}>
              {AMENDMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--tx3)', display: 'block', marginBottom: 4 }}>Description *</label>
            <textarea className="form-input" rows={3} style={{ resize: 'vertical', fontSize: 12 }} placeholder="Describe the change you'd like to request..." value={desc} onChange={(event) => setDesc(event.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" style={{ fontSize: 11 }} onClick={handleSubmit} disabled={!desc.trim() || request.isPending}>
              {request.isPending ? <LoadingSpinner size={11} /> : 'Submit request'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={{ padding: '12px 0', textAlign: 'center' }}><LoadingSpinner size={16} /></div>
      ) : amendments.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--tx4)', textAlign: 'center', padding: '16px 0' }}>
          {isApproved ? 'No amendment requests yet.' : 'Amendment requests are available for approved deals.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {amendments.map((amendment) => {
            const status = AMEND_STATUS_META[amendment.status] || AMEND_STATUS_META.pending;
            return (
              <div key={amendment.id} style={{ border: '1px solid var(--bdr)', borderRadius: 'var(--rl)', padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{AMENDMENT_TYPES.find((item) => item.value === amendment.amendment_type)?.label || amendment.amendment_type}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: status.color }}>{status.label}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--tx3)', lineHeight: 1.5 }}>{amendment.description}</div>
                {amendment.admin_notes && <div style={{ fontSize: 11, color: 'var(--tx4)', marginTop: 6, borderTop: '1px solid var(--bdr)', paddingTop: 6 }}>Admin: {amendment.admin_notes}</div>}
                <div style={{ fontSize: 10, color: 'var(--tx4)', marginTop: 4 }}>{formatDate(amendment.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DealDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: deal, isLoading } = useDeal(id);
  const { primaryCurrency, reportingCurrency, formatCurrency, formatDate, t } = useLocale();
  const originalCurrency = deal?.original_currency_code || deal?.reporting_currency_code || reportingCurrency;
  const { data: fx } = useFxRate(originalCurrency, primaryCurrency);

  if (isLoading) return <div className="page-loading"><LoadingSpinner size={24} /></div>;
  if (!deal) return <div className="page-error">{t('deals.notFound')}</div>;

  const status = STATUS_META[deal.status] || STATUS_META.submitted;
  const currentStep = status.step;
  const isApproved = deal.status === 'approved';
  const isRejected = deal.status === 'rejected';
  const currentMonthly = primaryCurrency === originalCurrency
    ? (deal.original_monthly_payment ?? deal.monthly_payment ?? 0)
    : convertWithRate(deal.original_monthly_payment ?? deal.monthly_payment ?? 0, fx?.rate);
  const currentAssetValue = primaryCurrency === originalCurrency
    ? (deal.original_asset_value ?? deal.asset_value ?? 0)
    : convertWithRate(deal.original_asset_value ?? deal.asset_value ?? 0, fx?.rate);
  const originalAmountFinanced = Math.max(0, (deal.original_asset_value ?? deal.asset_value ?? 0) - (deal.original_deposit ?? deal.deposit ?? 0) - (deal.original_balloon ?? deal.balloon ?? 0));

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/deals')}>
            <ArrowLeft size={14} /> {t('sidebar.myDeals')}
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="page-title">{deal.customer_name}</div>
              <span style={{ fontSize: 11, fontWeight: 600, color: status.color, background: `${status.color}18`, border: `1px solid ${status.color}33`, borderRadius: 10, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
                {status.icon}
                {status.label}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{deal.reference_number} - {deal.product_type}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 16 }}>{t('deals.applicationStatus')}</div>
            {isRejected ? (
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--red-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)', flexShrink: 0 }}>
                  <XCircle size={16} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--red)' }}>{t('deals.notApproved')}</div>
                  <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 3, lineHeight: 1.5 }}>{deal.admin_notes || t('deals.notApprovedSub')}</div>
                  {deal.reviewed_at && <div style={{ fontSize: 10, color: 'var(--tx4)', marginTop: 6 }}>{t('deals.decisionMade')} {formatDate(deal.reviewed_at, { day: 'numeric', month: 'long', year: 'numeric' })}</div>}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {TIMELINE_STEPS.map((step, index) => {
                  const done = currentStep > index + 1;
                  const active = currentStep === index + 1;
                  const pending = currentStep < index + 1;
                  return (
                    <div key={step.key} style={{ display: 'flex', gap: 12, paddingBottom: index < TIMELINE_STEPS.length - 1 ? 20 : 0 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: done ? 'var(--green)' : active ? 'var(--coral)' : 'var(--bg)', color: done || active ? '#fff' : 'var(--tx4)', border: pending ? '2px solid var(--bdr)' : 'none' }}>
                          {done ? <CheckCircle size={14} /> : index + 1}
                        </div>
                        {index < TIMELINE_STEPS.length - 1 && <div style={{ width: 2, flex: 1, background: done ? 'var(--green)' : 'var(--bdr)', minHeight: 16, marginTop: 3 }} />}
                      </div>
                      <div style={{ paddingBottom: index < TIMELINE_STEPS.length - 1 ? 8 : 0 }}>
                        <div style={{ fontWeight: active ? 700 : 600, fontSize: 13, color: active ? 'var(--coral)' : pending ? 'var(--tx4)' : 'var(--tx)' }}>
                          {step.label}
                          {active && <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--coral)', background: 'var(--coral-l)', borderRadius: 99, padding: '1px 8px' }}>{t('common.current')}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--tx4)', marginTop: 2 }}>{step.sub}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {isApproved && (
            <div className="info-banner" style={{ marginBottom: 14, borderColor: 'var(--green-m)', background: 'var(--green-l)' }}>
              <CheckCircle size={14} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, color: 'var(--tx2)', flex: 1 }}>{t('deals.approvedBanner')}</div>
              <button className="btn btn-ghost" style={{ fontSize: 11, border: '1px solid var(--green-m)', color: 'var(--green-d)' }} onClick={() => navigate('/portfolio')}>
                <ExternalLink size={11} /> {t('deals.viewContract')}
              </button>
            </div>
          )}

          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Building2 size={14} style={{ color: 'var(--coral)' }} />
              <div style={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx3)' }}>{t('deals.clientAndDeal')}</div>
            </div>
            <Row label={t('deals.clientName')} value={deal.customer_name} />
            <Row label={t('deals.productType')} value={deal.product_type} />
            <Row label={t('deals.originalCurrency')} value={originalCurrency} />
            <Row label={t('deals.yourReference')} value={deal.originator_reference} />
            <Row label={t('deals.preferredStart')} value={deal.preferred_start_date ? formatDate(deal.preferred_start_date, { year: 'numeric', month: 'short', day: 'numeric' }) : null} />
            <Row label={t('deals.notes')} value={deal.notes} />
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Wrench size={14} style={{ color: 'var(--coral)' }} />
              <div style={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx3)' }}>{t('deals.asset')}</div>
            </div>
            <Row label={t('deals.type')} value={deal.asset_type} />
            <Row label={t('deals.make')} value={deal.asset_make} />
            <Row label={t('deals.model')} value={deal.asset_model} />
            <Row label={t('deals.year')} value={deal.asset_year} />
            <Row label={t('deals.originalAmount')} value={formatCurrency(deal.original_asset_value ?? deal.asset_value ?? 0, originalCurrency)} />
            {primaryCurrency !== originalCurrency && Number.isFinite(currentAssetValue) && <Row label={t('deals.currentValue')} value={formatCurrency(currentAssetValue, primaryCurrency)} />}
          </div>

          <AmendmentPanel dealId={id} isApproved={isApproved} />
        </div>

        <div>
          <div className="calc-box" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <CreditCard size={14} style={{ color: 'var(--coral)' }} />
              <div style={{ fontWeight: 700, fontSize: 14 }}>{t('deals.financeSummary')}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px 0 18px', borderBottom: '1px solid var(--bdr)', marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{t('deals.monthlyPayment')}</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--coral)', lineHeight: 1.2 }}>{formatCurrency(deal.original_monthly_payment ?? deal.monthly_payment ?? 0, originalCurrency)}</div>
              {primaryCurrency !== originalCurrency && Number.isFinite(currentMonthly) && <div style={{ fontSize: 11, color: 'var(--tx4)', marginTop: 4 }}>{formatCurrency(currentMonthly, primaryCurrency)}</div>}
            </div>
            {[
              [t('common.assetValue'), formatCurrency(deal.original_asset_value ?? deal.asset_value ?? 0, originalCurrency)],
              [t('deals.deposit'), (deal.original_deposit ?? deal.deposit) ? formatCurrency(deal.original_deposit ?? deal.deposit ?? 0, originalCurrency) : t('common.none')],
              [t('deals.balloon'), (deal.original_balloon ?? deal.balloon) ? formatCurrency(deal.original_balloon ?? deal.balloon ?? 0, originalCurrency) : t('common.none')],
              [t('deals.amountFinanced'), formatCurrency(originalAmountFinanced, originalCurrency)],
              [t('common.term'), t('deals.months', { count: deal.term_months })],
              [t('deals.rateType'), deal.rate_type],
              ['APR', `${deal.apr}%`],
              [t('deals.totalPayable'), formatCurrency(deal.original_total_payable ?? deal.total_payable ?? 0, originalCurrency)],
              [t('deals.reportingValue', { currency: reportingCurrency }), formatCurrency(deal.reporting_total_payable ?? deal.total_payable ?? 0, reportingCurrency)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: 'var(--tx3)' }}>{label}</span>
                <span style={{ fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10 }}>{t('common.submitted')}</div>
            <Row label={t('common.reference')} value={deal.reference_number} />
            <Row label={t('deals.dateSubmitted')} value={formatDate(deal.created_at, { day: 'numeric', month: 'long', year: 'numeric' })} />
            <Row label={t('deals.fxSource')} value={deal.fx_source ? `${deal.fx_source} @ ${deal.fx_rate}` : null} />
            {deal.reviewed_at && <Row label={t('deals.decisionDate')} value={formatDate(deal.reviewed_at, { day: 'numeric', month: 'long', year: 'numeric' })} />}
          </div>

          {deal.status === 'under_review' && (
            <div className="info-banner blue" style={{ marginTop: 12 }}>
              <Info size={14} style={{ color: 'var(--blue)', flexShrink: 0 }} />
              <div style={{ fontSize: 11, lineHeight: 1.6 }}>{t('deals.underReviewNotice')}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
