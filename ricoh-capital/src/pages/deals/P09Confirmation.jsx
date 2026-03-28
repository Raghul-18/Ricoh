import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Info, LayoutDashboard, Plus } from 'lucide-react';
import { useDealStore } from '../../store/dealStore';
import { useLocale } from '../../context/LocaleContext';

export default function P09Confirmation() {
  const navigate = useNavigate();
  const { submittedRefNumber, initiation, dealDetails, getMonthlyPayment, reset } = useDealStore();
  const { formatCurrency, t } = useLocale();

  useEffect(() => {
    if (!submittedRefNumber) navigate('/deals/new');
  }, [submittedRefNumber, navigate]);

  const monthly = getMonthlyPayment();
  const currencyCode = initiation.currencyCode || 'GBP';

  return (
    <div className="page" style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ width: 72, height: 72, background: 'var(--green-l)', border: '2px solid var(--green-m)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={36} style={{ color: 'var(--green)' }} />
          </div>
        </div>
        <div style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-.3px', marginBottom: 8 }}>{t('deals.dealSubmitted')}</div>
        <div style={{ fontSize: 14, color: 'var(--tx3)' }}>Your deal has been submitted for credit review.</div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>{t('deals.dealSummary')}</div>
        {[
          [t('deals.referenceNumber'), submittedRefNumber, true],
          ['Customer', initiation.customerName],
          ['Product', initiation.productType],
          ['Family', initiation.productFamily.replace('_', ' ')],
          ['Deal currency', currencyCode],
          ['Your reference', initiation.originatorReference],
          ['Summary', dealDetails.equipmentDescription || dealDetails.purpose || `${dealDetails.make || ''} ${dealDetails.model || ''}`.trim() || dealDetails.assetType],
          [t('deals.monthlyPayment'), formatCurrency(monthly, currencyCode)],
          ['Term', `${dealDetails.termMonths} months`],
        ].map(([label, value, mono]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingBottom: 6, borderBottom: '1px solid var(--bdr)', marginBottom: 6 }}>
            <span style={{ color: 'var(--tx3)' }}>{label}</span>
            <span style={{ fontWeight: mono ? 700 : 500, fontFamily: mono ? "'DM Mono', monospace" : undefined, color: mono ? 'var(--coral)' : undefined }}>{value}</span>
          </div>
        ))}
      </div>

      <div className="info-banner blue" style={{ marginBottom: 24 }}>
        <Info size={15} style={{ color: 'var(--blue)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 11, lineHeight: 1.7 }}>
          <strong>Next steps:</strong> A Ricoh Capital credit analyst will review your application. If approved, the admin will generate the customer temporary login and both parties will complete in-app signatures before the contract becomes fully active.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => navigate('/portfolio')}>
          <LayoutDashboard size={14} /> View portfolio
        </button>
        <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { reset(); navigate('/deals/new'); }}>
          <Plus size={14} /> Submit another deal
        </button>
      </div>
    </div>
  );
}
