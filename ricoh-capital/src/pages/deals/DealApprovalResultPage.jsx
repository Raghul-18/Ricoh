import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Mail, PenSquare, ShieldCheck, TimerReset } from 'lucide-react';

export default function DealApprovalResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const result = location.state?.approvalResult;

  if (!result) {
    return (
      <div className="page">
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 10 }}>Approval result not available</div>
            <div style={{ fontSize: 13, color: 'var(--tx3)', marginBottom: 16 }}>
            The onboarding invite details are only shown immediately after approval.
            </div>
          <button className="btn btn-primary" onClick={() => navigate('/admin/deals')}>Back to deal queue</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <div className="page-title">Deal approved</div>
          <div className="page-sub">Customer access and contract signature setup for deal {id}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Customer onboarding invite</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="info-banner blue">
            <Mail size={14} style={{ color: 'var(--blue)', flexShrink: 0 }} />
            <div style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600 }}>Customer email</div>
              <div>{result.customerEmail}</div>
            </div>
          </div>
          <div className="info-banner" style={{ borderColor: 'var(--amber)', background: 'var(--amber-l)' }}>
            <TimerReset size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
            <div style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600 }}>Invite expiry</div>
              <div>{result.onboardingInvite?.expiresAt ? new Date(result.onboardingInvite.expiresAt).toLocaleString() : 'Invite already exists for this contract'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Contract and signature status</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div className="metric-card">
            <ShieldCheck size={18} style={{ color: 'var(--coral)', marginBottom: 8 }} />
            <div className="metric-value" style={{ fontSize: 20 }}>{result.contractReference}</div>
            <div className="metric-label">Contract reference</div>
          </div>
          <div className="metric-card">
            <PenSquare size={18} style={{ color: 'var(--blue)', marginBottom: 8 }} />
            <div className="metric-value" style={{ fontSize: 20 }}>{result.signatureStatus?.customerSigned ? 'Signed' : 'Pending'}</div>
            <div className="metric-label">Customer signature</div>
          </div>
          <div className="metric-card">
            <PenSquare size={18} style={{ color: 'var(--green)', marginBottom: 8 }} />
            <div className="metric-value" style={{ fontSize: 20 }}>{result.signatureStatus?.adminSigned ? 'Signed' : 'Pending'}</div>
            <div className="metric-label">Admin signature</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" onClick={() => navigate(`/portfolio/${result.contractId}`)}>
          Open contract
        </button>
        <button className="btn btn-ghost" onClick={() => navigate('/admin/deals')}>
          Back to deal queue
        </button>
      </div>
    </div>
  );
}
