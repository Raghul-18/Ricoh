import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Info, Check } from 'lucide-react';
import { useDealStore } from '../../store/dealStore';
import { useSubmitDeal } from '../../hooks/useDeals';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../auth/AuthContext';
import { LoadingSpinner } from '../../components/shared/FormField';

export default function P08ReviewSubmit() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { initiation, assetDetails, getMonthlyPayment, getTotalPayable } = useDealStore();
  const submitDeal = useSubmitDeal();
  const { showToast } = useAppContext();

  if (!initiation.customerName) {
    navigate('/deals/new');
    return null;
  }

  const monthly = getMonthlyPayment();
  const total = getTotalPayable();

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
      {rows.filter(([, v]) => v !== undefined && v !== '' && v !== null).map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingBottom: 6, borderBottom: '1px solid var(--bdr)', marginBottom: 6 }}>
          <span style={{ color: 'var(--tx3)' }}>{k}</span>
          <span style={{ fontWeight: 500 }}>{v}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Review & Submit</div>
          <div className="page-sub">Step 3 of 3 — Review all details before submitting</div>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate('/deals/assets')}><ArrowLeft size={14} /> Back</button>
      </div>

      {/* Progress */}
      <div className="steps-row" style={{ marginBottom: 24 }}>
        {['Initiation', 'Asset details', 'Review & submit'].map((s, i) => (
          <div key={s} className={`step ${i === 2 ? 'active' : 'done'}`}>
            <div className="step-dot">{i < 2 ? <Check size={12} /> : 3}</div>
            <div className="step-label">{s}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
        <div>
          <Section title="Submission details" rows={[
            ['Submitted by', profile?.company_name || profile?.full_name || 'You'],
          ]} />
          <Section title="Client & deal" rows={[
            ['Client name', initiation.customerName],
            ['Product type', initiation.productType],
            ['Your reference', initiation.originatorReference],
            ['Preferred start', initiation.preferredStartDate || 'Not specified'],
            ['Notes', initiation.notes || 'None'],
          ]} />
          <Section title="Asset" rows={[
            ['Type', assetDetails.assetType],
            ['Make & model', `${assetDetails.make} ${assetDetails.model}`],
            ['Year', assetDetails.year],
            ['Asset value', `£${(assetDetails.assetValue || 0).toLocaleString()}`],
          ]} />
          <Section title="Finance structure" rows={[
            ['Term', `${assetDetails.termMonths} months`],
            ['Rate type', assetDetails.rateType],
            ['APR', '7.2%'],
            ['Deposit', assetDetails.deposit ? `£${assetDetails.deposit.toLocaleString()}` : 'None'],
            ['Balloon', assetDetails.balloon ? `£${assetDetails.balloon.toLocaleString()}` : 'None'],
            ['Amount financed', `£${((assetDetails.assetValue || 0) - (assetDetails.deposit || 0) - (assetDetails.balloon || 0)).toLocaleString()}`],
          ]} />
        </div>

        <div>
          <div className="calc-box" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Finance summary</div>
            <div style={{ textAlign: 'center', padding: '16px 0', borderBottom: '1px solid var(--bdr)', marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--tx3)' }}>Monthly payment</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--coral)' }}>£{monthly.toLocaleString()}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: 'var(--tx3)' }}>Total payable</span>
              <span style={{ fontWeight: 600 }}>£{total.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--tx3)' }}>Over</span>
              <span style={{ fontWeight: 600 }}>{assetDetails.termMonths} months</span>
            </div>
          </div>

          <div className="info-banner blue" style={{ marginBottom: 16 }}>
            <Info size={14} style={{ color: 'var(--blue)', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 11, lineHeight: 1.6 }}>
              On submission, your deal will enter the Zoro Capital credit review queue. You'll be notified of the decision within 2 business days.
            </div>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', height: 44, fontSize: 14 }}
            onClick={handleSubmit}
            disabled={submitDeal.isPending}
          >
            {submitDeal.isPending ? <><LoadingSpinner /> Submitting…</> : <><Send size={14} /> Submit for credit review</>}
          </button>

          <button
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            onClick={() => navigate('/deals/assets')}
          >
            <ArrowLeft size={14} /> Edit asset details
          </button>
        </div>
      </div>
    </div>
  );
}
