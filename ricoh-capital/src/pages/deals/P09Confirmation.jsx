import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Plus, LayoutDashboard, Info } from 'lucide-react';
import { useDealStore } from '../../store/dealStore';

export default function P09Confirmation() {
  const navigate = useNavigate();
  const { submittedRefNumber, submittedDealId, initiation, assetDetails, getMonthlyPayment, reset } = useDealStore();

  useEffect(() => { if (!submittedRefNumber) navigate('/deals/new'); }, [submittedRefNumber]);

  const monthly = getMonthlyPayment();

  const handleNewDeal = () => { reset(); navigate('/deals/new'); };

  return (
    <div className="page" style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ width: 72, height: 72, background: 'var(--green-l)', border: '2px solid var(--green-m)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={36} style={{ color: 'var(--green)' }} />
          </div>
        </div>
        <div style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-.3px', marginBottom: 8 }}>Deal submitted</div>
        <div style={{ fontSize: 14, color: 'var(--tx3)' }}>Your deal has been submitted for credit review.</div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Deal summary</div>
        {[
          ['Reference number', submittedRefNumber, true],
          ['Customer', initiation.customerName],
          ['Product', initiation.productType],
          ['Your reference', initiation.originatorReference],
          ['Asset', `${assetDetails.year} ${assetDetails.make} ${assetDetails.model}`],
          ['Asset value', `£${(assetDetails.assetValue || 0).toLocaleString()}`],
          ['Monthly payment', `£${monthly.toLocaleString()}`],
          ['Term', `${assetDetails.termMonths} months`],
        ].map(([k, v, mono]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingBottom: 6, borderBottom: '1px solid var(--bdr)', marginBottom: 6 }}>
            <span style={{ color: 'var(--tx3)' }}>{k}</span>
            <span style={{ fontWeight: mono ? 700 : 500, fontFamily: mono ? "'DM Mono', monospace" : undefined, color: mono ? 'var(--coral)' : undefined }}>{v}</span>
          </div>
        ))}
      </div>

      <div className="info-banner blue" style={{ marginBottom: 24 }}>
        <Info size={15} style={{ color: 'var(--blue)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 11, lineHeight: 1.7 }}>
          <strong>Next steps:</strong> A Zoro Capital credit analyst will review your application within 2 business days. You'll receive an email when a decision is made.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => navigate('/portfolio')}>
          <LayoutDashboard size={14} /> View portfolio
        </button>
        <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleNewDeal}>
          <Plus size={14} /> Submit another deal
        </button>
      </div>
    </div>
  );
}
