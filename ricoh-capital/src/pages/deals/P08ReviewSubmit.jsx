import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Info, Send } from 'lucide-react';
import { useDealStore } from '../../store/dealStore';
import { useSubmitDeal } from '../../hooks/useDeals';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../auth/AuthContext';
import { LoadingSpinner } from '../../components/shared/FormField';
import { useLocale } from '../../context/LocaleContext';

export default function P08ReviewSubmit() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { initiation, assetDetails, getMonthlyPayment, getTotalPayable } = useDealStore();
  const submitDeal = useSubmitDeal();
  const { showToast } = useAppContext();
  const { formatCurrency, t } = useLocale();

  if (!initiation.customerName) {
    navigate('/deals/new');
    return null;
  }

  const monthly = getMonthlyPayment();
  const total = getTotalPayable();
  const currencyCode = initiation.currencyCode || 'GBP';

  const handleSubmit = async () => {
    try {
      await submitDeal.mutateAsync();
      showToast('Deal submitted successfully!', 'success');
      navigate('/deals/confirmation');
    } catch (err) {
      showToast(err.message || 'Submission failed. Please try again.', 'error');
    }
  };

  const Section = ({ title, rows }) => (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 12, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{title}</div>
      {rows.filter(([, value]) => value !== undefined && value !== '' && value !== null).map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingBottom: 6, borderBottom: '1px solid var(--bdr)', marginBottom: 6 }}>
          <span style={{ color: 'var(--tx3)' }}>{label}</span>
          <span style={{ fontWeight: 500 }}>{value}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{t('deals.reviewSubmit')}</div>
          <div className="page-sub">Step 3 of 3 - Review all details before submitting</div>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate('/deals/assets')}><ArrowLeft size={14} /> Back</button>
      </div>

      <div className="steps-row" style={{ marginBottom: 24 }}>
        {['Initiation', 'Asset details', 'Review & submit'].map((step, index) => (
          <div key={step} className={`step ${index === 2 ? 'active' : 'done'}`}>
            <div className="step-dot">{index < 2 ? <Check size={12} /> : 3}</div>
            <div className="step-label">{step}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
        <div>
          <Section title="Submission details" rows={[['Submitted by', profile?.company_name || profile?.full_name || 'You']]} />
          <Section title="Client & deal" rows={[
            ['Client name', initiation.customerName],
            ['Product type', initiation.productType],
            ['Deal currency', currencyCode],
            ['Your reference', initiation.originatorReference],
            ['Preferred start', initiation.preferredStartDate || 'Not specified'],
            ['Notes', initiation.notes || 'None'],
          ]} />
          <Section title="Asset" rows={[
            ['Type', assetDetails.assetType],
            ['Make & model', `${assetDetails.make} ${assetDetails.model}`],
            ['Year', assetDetails.year],
            ['Asset value', formatCurrency(assetDetails.assetValue || 0, currencyCode)],
          ]} />
          <Section title="Finance structure" rows={[
            ['Term', `${assetDetails.termMonths} months`],
            ['Rate type', assetDetails.rateType],
            ['APR', '7.2%'],
            ['Deposit', assetDetails.deposit ? formatCurrency(assetDetails.deposit, currencyCode) : 'None'],
            ['Balloon', assetDetails.balloon ? formatCurrency(assetDetails.balloon, currencyCode) : 'None'],
            ['Amount financed', formatCurrency((assetDetails.assetValue || 0) - (assetDetails.deposit || 0) - (assetDetails.balloon || 0), currencyCode)],
          ]} />
        </div>

        <div>
          <div className="calc-box" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{t('deals.financeSummary')}</div>
            <div style={{ textAlign: 'center', padding: '16px 0', borderBottom: '1px solid var(--bdr)', marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{t('deals.monthlyPayment')}</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--coral)' }}>{formatCurrency(monthly, currencyCode)}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: 'var(--tx3)' }}>{t('deals.totalPayable')}</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(total, currencyCode)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: 'var(--tx3)' }}>{t('deals.dealCurrency')}</span>
              <span style={{ fontWeight: 600 }}>{currencyCode}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--tx4)', marginTop: 10 }}>{t('deals.originalCurrencyLocked')}</div>
          </div>

          <div className="info-banner blue" style={{ marginBottom: 16 }}>
            <Info size={14} style={{ color: 'var(--blue)', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 11, lineHeight: 1.6 }}>
              On submission, your deal enters the Ricoh Capital credit review queue. A GBP reporting value will be frozen for reporting, while the original deal currency remains unchanged.
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: 44, fontSize: 14 }} onClick={handleSubmit} disabled={submitDeal.isPending}>
            {submitDeal.isPending ? <><LoadingSpinner /> Submitting...</> : <><Send size={14} /> Submit for credit review</>}
          </button>

          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={() => navigate('/deals/assets')}>
            <ArrowLeft size={14} /> Edit asset details
          </button>
        </div>
      </div>
    </div>
  );
}
